// WebRTC初期化関数
async function initializeWebRTC() {
  try {
    isConnecting = true;
    updateStatus("Initializing...");
    hideError();

    // 選択されたモデルを取得
    const selectedModel = elements.modelSelect.value;
    currentModel = selectedModel;
    addDebugLog(`Using model: ${selectedModel}`);

    // 選択された音声モデルを取得（初期化時）
    currentVoice = elements.voiceSelect.value;
    addDebugLog(`Using voice: ${currentVoice}`);
    
    // 指示文を取得（初期化時）- 明示的に保存
    const userInstructions = elements.instructionsInput.value.trim();
    if (userInstructions) {
      currentInstructions = userInstructions;
      addDebugLog(`Saving user instructions for later use: "${currentInstructions}"`);
    }

    // 接続中は設定変更を無効化
    elements.voiceSelect.disabled = true;
    elements.instructionsInput.disabled = true;
    elements.audioCheckbox.disabled = true;

    // セッショントークンを取得
    const token = await getSessionToken(selectedModel);
    currentSessionToken = token;

    // ピア接続の作成
    const pc = new RTCPeerConnection();
    peerConnection = pc;
    addDebugLog("Peer connection created");

    // ローカル音声トラックの追加
    addDebugLog("Getting microphone access...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
    addDebugLog("Added local audio track");

    // 接続状態の監視
    pc.onconnectionstatechange = () => {
      addDebugLog(`Connection state changed to: ${pc.connectionState}`);
    };

    pc.oniceconnectionstatechange = () => {
      addDebugLog(`ICE connection state changed to: ${pc.iceConnectionState}`);
    };

    pc.onicegatheringstatechange = () => {
      addDebugLog(`ICE gathering state changed to: ${pc.iceGatheringState}`);
    };

    pc.onicecandidate = (event) => {
      addDebugLog(`ICE candidate: ${event.candidate ? "received" : "null"}`);
    };

    // リモート音声トラックの処理
    pc.ontrack = (event) => {
      addDebugLog("Received remote audio track");
      const audioElement = new Audio();
      audioElement.srcObject = event.streams[0];
      audioElement.play().catch((error) => {
        addDebugLog(`Error playing audio: ${error}`);
      });
    };

    // データチャネルの設定
    const dc = pc.createDataChannel("oai-events");
    dataChannel = dc;
    addDebugLog("Data channel created");

    // データチャネルのイベントリスナー追加
    dc.onopen = () => {
      addDebugLog("Data channel opened");
      updateDataChannelStatus(true);
      updateStatus("Ready");
      isConnecting = false;
      isConnected = true;

      // ボタンとセレクトの状態を更新
      elements.connectButton.disabled = true;
      elements.disconnectButton.disabled = false;
      elements.modelSelect.disabled = true;
      
      // 接続成功後に設定操作を再度有効化
      elements.voiceSelect.disabled = false;
      elements.instructionsInput.disabled = false;
      elements.audioCheckbox.disabled = false;
    };

    dc.onclose = () => {
      addDebugLog("Data channel closed");
      updateDataChannelStatus(false);
    };

    dc.onerror = (error) => {
      const errorMsg = `Data channel error: ${error.toString()}`;
      addDebugLog(errorMsg);
      showError(errorMsg);
    };

    // レスポンスのJSONテキストオブジェクトからプレーンテキストを抽出する関数
    function extractTextFromResponse(jsonText) {
      try {
        // JSONをパースする
        const responseObj = JSON.parse(jsonText);
        
        // 一般的なパターン: voiceResponse や text プロパティにテキストが含まれる
        if (responseObj.voiceResponse) {
          return responseObj.voiceResponse;
        } else if (responseObj.text) {
          return responseObj.text;
        } else {
          // そのままのテキストを返す
          return jsonText;
        }
      } catch (e) {
        // JSONのパースに失敗した場合は元のテキストをそのまま返す
        console.log("Failed to parse JSON text:", e);
        return jsonText;
      }
    }

    // 新規追加: session.createdイベント後に自動的にセッション更新を実行する関数
    async function autoUpdateSessionAfterCreation() {
      // 少し遅延を入れて、セッション作成が完了するのを待つ
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!isDataChannelReady || !dataChannel) {
        addDebugLog("Cannot auto-update session: data channel not ready");
        return;
      }
      
      try {
        addDebugLog("Automatically updating session after creation...");
        
        // 現在の設定値を取得
        const selectedVoice = elements.voiceSelect.value;
        
        // 保存しておいた指示文を使用 - elements の値でなく currentInstructions を優先
        let selectedInstructions = currentInstructions;
        if (!selectedInstructions && elements.instructionsInput.value.trim()) {
          selectedInstructions = elements.instructionsInput.value.trim();
        }
        
        const selectedModalities = getSelectedModalities();
        
        if (selectedModalities.length === 0) {
          addDebugLog("Auto-update aborted: No modalities selected");
          return;
        }
        
        addDebugLog(`Auto-updating with voice: ${selectedVoice}`);
        if (selectedInstructions) {
          addDebugLog(`Auto-updating with instructions: "${selectedInstructions}"`);
        } else {
          addDebugLog("Auto-updating without custom instructions");
        }
        addDebugLog(`Auto-updating with modalities: ${selectedModalities.join(", ")}`);
        
        // セッション更新リクエストを作成
        const updateRequest = formatSessionUpdateRequest(
          selectedVoice,
          selectedInstructions || undefined,
          selectedModalities
        );
        
        // JSONメッセージとして表示
        const formattedUpdateRequest = JSON.stringify(updateRequest, null, 2);
        addMessage("user", formattedUpdateRequest);
        
        // データチャネルを通じて送信
        dataChannel.send(JSON.stringify(updateRequest));
        addDebugLog("Auto session update request sent");
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to auto-update session";
        addDebugLog(`Error during auto-update: ${errorMessage}`);
      }
    }

    dc.onmessage = (event) => {
      // まずは受信したデータをデバッグログに追加（生データ）
      addDebugLog(`Received raw data: ${event.data}`);

      try {
        // JSONとしてパースを試みる
        const realtimeEvent = JSON.parse(event.data);
        
        // デバッグ出力を短くする（長いテキストはトリミング）
        let debugData = JSON.stringify(realtimeEvent);
        if (debugData.length > 100) {
          debugData = debugData.substring(0, 100) + "...";
        }
        addDebugLog(`Parsed event: ${debugData}`);

        // response.text または response.text.delta イベントの処理
        if (realtimeEvent.type === "response.text" || realtimeEvent.type === "response.text.delta") {
          // response.text.delta の場合は delta プロパティを使用、通常の response.text の場合は text プロパティを使用
          const textContent = realtimeEvent.type === "response.text.delta" ? realtimeEvent.delta : realtimeEvent.text;
          
          // テキストコンテンツがある場合のみ処理
          if (typeof textContent === "string") {
            // テキストコンテンツが空文字でも処理する
            addDebugLog(`Received text delta: [${textContent.length} chars] (type: ${realtimeEvent.type})`);
            
            // JSON形式かどうかを判断し、必要に応じてテキストを抽出
            let displayText = textContent;
            if (displayText.trim().startsWith("{") && displayText.trim().endsWith("}")) {
              try {
                displayText = extractTextFromResponse(displayText);
              } catch (e) {
                addDebugLog(`Failed to extract text from JSON: ${e}`);
              }
            }
            
            // コンソールに内容の一部を表示
            const textPreview = displayText.length > 20 
              ? displayText.substring(0, 20) + "..." 
              : displayText;
            console.log("Text delta preview:", textPreview);
            
            // テキストデルタを表示領域に追加
            updateResponseText(displayText);
          } else {
            // テキストプロパティがない場合や文字列でない場合
            addDebugLog(`Invalid response.text/delta event: ${JSON.stringify(realtimeEvent)}`);
          }
        }
        // response.text.done イベントの処理を追加
        else if (realtimeEvent.type === "response.text.done") {
          addDebugLog(`Received text done event with text: ${realtimeEvent.text?.substring(0, 50)}...`);
          // JSON形式かどうかを判断し、必要に応じてテキストを抽出
          if (typeof realtimeEvent.text === "string") {
            let displayText = realtimeEvent.text;
            if (displayText.trim().startsWith("{") && displayText.trim().endsWith("}")) {
              try {
                displayText = extractTextFromResponse(displayText);
              } catch (e) {
                addDebugLog(`Failed to extract text from JSON: ${e}`);
              }
            }
            // 最終的なテキストを表示する場合は、ここで処理
            addDebugLog(`Final text content: ${displayText.substring(0, 50)}...`);
          }
          
          // レスポンス完了時の処理
          completeResponseText();
        }
        // セッション更新イベントの処理
        else if (realtimeEvent.type === "session.updated") {
          addDebugLog("Session update completed successfully");
          const formattedData = JSON.stringify(realtimeEvent, null, 2);
          addMessage("assistant", formattedData);
          
          // 更新完了時の状態更新
          if (isUpdatingSession) {
            isUpdatingSession = false;
            updateStatus("Ready");
            elements.updateStatus.classList.add("hidden");
            elements.updateSessionButton.disabled = false;
            currentVoice = elements.voiceSelect.value;
            
            // 指示文の更新 - session.updated レスポンスから最新の指示文を取得
            if (realtimeEvent.session && realtimeEvent.session.instructions !== undefined) {
              currentInstructions = realtimeEvent.session.instructions;
              elements.instructionsInput.value = currentInstructions;
              addDebugLog(`Instructions updated to: "${currentInstructions}"`);
            }
            
            addDebugLog(`Voice model updated to: ${currentVoice}`);
          }
        }
        // response.doneイベントの処理（変更なし）
        else if (realtimeEvent.type === "response.done") {
          // レスポンス完了時の処理を追加
          completeResponseText();
          // 重要なイベントはJSONとして整形して表示（以前と同じ）
          const formattedData = JSON.stringify(realtimeEvent, null, 2);
          addMessage("assistant", formattedData);
        }
        // session.createdイベントの処理（変更あり - 自動セッション更新を追加）
        else if (realtimeEvent.type === "session.created") {
          // 重要なイベントはJSONとして整形して表示
          const formattedData = JSON.stringify(realtimeEvent, null, 2);
          addMessage("assistant", formattedData);
          
          // セッション作成時の指示文取得 - ユーザー入力の保持
          const userInstructions = elements.instructionsInput.value.trim();
          
          // ユーザーが事前に入力していない場合のみ、サーバーのデフォルト指示文を使用
          if (!userInstructions && realtimeEvent.session && realtimeEvent.session.instructions !== undefined) {
            currentInstructions = realtimeEvent.session.instructions;
            elements.instructionsInput.value = currentInstructions;
            addDebugLog(`Using default instructions from server: "${currentInstructions}"`);
          } else if (userInstructions) {
            // ユーザーが入力済みの場合はその値を維持
            currentInstructions = userInstructions;
            addDebugLog(`Keeping user-provided instructions: "${currentInstructions}"`);
          }
          
          // 新規追加: session.created 後に自動的にセッション更新を実行
          autoUpdateSessionAfterCreation();
        }
        // 変更: トランスクリプトのデルタ更新と完了イベントの処理を追加
        else if (realtimeEvent.type === "response.audio_transcript.delta") {
          // デルタタイプの場合のみ処理
          if (typeof realtimeEvent.delta === "string") {
            addDebugLog(`Received transcript delta: [${realtimeEvent.delta.length} chars]`);
            updateTranscriptText(realtimeEvent.delta);
          } else {
            addDebugLog(`Invalid transcript delta: ${JSON.stringify(realtimeEvent)}`);
          }
        }
        // 完了したトランスクリプトの処理 - 従来のサポートを維持しつつ、デルタ処理も追加
        else if (realtimeEvent.type === "response.audio_transcript.done") {
          if (typeof realtimeEvent.transcript === "string") {
            // 従来のサポート - 完全なトランスクリプトを表示
            if (isNewTranscript) {
              // 新しいトランスクリプトの場合は addTranscript を使用
              addTranscript(realtimeEvent.transcript);
            } else {
              // 既にデルタ更新が行われている場合は、完了処理のみ
              completeTranscriptText();
            }
          } else {
            addDebugLog(`Invalid transcript done event: ${JSON.stringify(realtimeEvent)}`);
          }
        }
        // その他のイベントはデバッグログにのみ記録し、UIには表示しない
      } catch (error) {
        // JSONのパースに失敗した場合は、デバッグログにエラーを記録
        addDebugLog(`Error parsing event: ${error}`);
        // パースエラーの場合は重要なので、UIにも表示
        addMessage("assistant", `[Parse Error] Raw data: ${event.data}`);
      }
    };

    // オファーの作成とローカル記述の設定
    addDebugLog("Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    addDebugLog("Local description set");

    // リモート記述を取得して設定
    try {
      const answer = await getRemoteDescription(
        offer.sdp,
        token,
        selectedModel
      );
      const answerSdp = {
        type: "answer",
        sdp: answer,
      };
      await peerConnection.setRemoteDescription(answerSdp);
      addDebugLog("Remote description set");
      updateStatus("Connecting...");
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to set remote description";
      addDebugLog(`Error: ${errorMsg}`);
      showError(errorMsg);
      isConnecting = false;
      disconnectConnection(); // エラー時は接続を切断
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to initialize WebRTC";
    addDebugLog(`Error: ${errorMessage}`);
    showError(errorMessage);
    updateStatus("Error");
    isConnecting = false;
    isConnected = false;

    // ボタンとセレクトの状態を更新
    elements.connectButton.disabled = false;
    elements.disconnectButton.disabled = true;
    elements.modelSelect.disabled = false;
    
    // エラー時も設定入力は有効に保つ
    elements.voiceSelect.disabled = false;
    elements.instructionsInput.disabled = false;
    elements.audioCheckbox.disabled = false;
  }
}

// セッションを更新する関数（指示文サポートを追加）
async function updateSession() {
  if (!isDataChannelReady || !dataChannel) {
    addDebugLog("Cannot update session: data channel not ready");
    showError("Data channel not ready");
    return;
  }

  try {
    isUpdatingSession = true;
    updateStatus("Updating Session...");
    elements.updateStatus.classList.remove("hidden");
    elements.updateSessionButton.disabled = true;

    // 選択された音声モデルを取得
    const selectedVoice = elements.voiceSelect.value;
    // 入力された指示文を取得
    const selectedInstructions = elements.instructionsInput.value.trim();
    // 選択されたモダリティを取得（追加）
    const selectedModalities = getSelectedModalities();
    
    if (selectedModalities.length === 0) {
      // 少なくとも1つのモダリティが選択されていることを確認
      showError("少なくとも1つの応答形式（テキストまたは音声）を選択してください");
      isUpdatingSession = false;
      updateStatus("Ready");
      elements.updateStatus.classList.add("hidden");
      elements.updateSessionButton.disabled = false;
      return;
    }
    
    addDebugLog(`Updating session with voice: ${selectedVoice}`);
    addDebugLog(`Updating session with instructions: "${selectedInstructions}"`);
    addDebugLog(`Updating session with modalities: ${selectedModalities.join(", ")}`);

    // セッション更新リクエストを作成（モダリティを追加）
    const updateRequest = formatSessionUpdateRequest(
      selectedVoice, 
      selectedInstructions || undefined, 
      selectedModalities
    );
    
    // JSONメッセージとして表示
    const formattedUpdateRequest = JSON.stringify(updateRequest, null, 2);
    addMessage("user", formattedUpdateRequest);
    
    // データチャネルを通じて送信
    dataChannel.send(JSON.stringify(updateRequest));
    addDebugLog("Session update request sent");
    
    // タイムアウト処理（10秒後に反応がなければエラー扱い）
    setTimeout(() => {
      if (isUpdatingSession) {
        isUpdatingSession = false;
        updateStatus("Ready");
        elements.updateStatus.classList.add("hidden");
        elements.updateSessionButton.disabled = false;
        showError("Session update timed out. Settings may not be changeable if audio has already been generated.");
        addDebugLog("Session update timed out");
      }
    }, 10000);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update session";
    addDebugLog(`Error: ${errorMessage}`);
    showError(errorMessage);
    
    // エラー時の状態復帰
    isUpdatingSession = false;
    updateStatus("Ready");
    elements.updateStatus.classList.add("hidden");
    elements.updateSessionButton.disabled = false;
  }
}

// 接続切断関数
function disconnectConnection() {
  try {
    // データチャネルのクローズ
    if (dataChannel) {
      dataChannel.close();
      dataChannel = null;
    }

    // ピア接続のクローズ
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    // 状態の更新
    updateDataChannelStatus(false);
    updateStatus("Disconnected");
    isConnected = false;
    currentSessionToken = null;
    addDebugLog("Connection terminated");

    // ボタンとセレクトの状態を更新
    elements.connectButton.disabled = false;
    elements.disconnectButton.disabled = true;
    elements.modelSelect.disabled = false;
    
    // 切断後も設定は編集可能に保つ
    elements.voiceSelect.disabled = false;
    elements.instructionsInput.disabled = false;
    elements.audioCheckbox.disabled = false;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to disconnect properly";
    showError(errorMessage);
    addDebugLog(`Error during disconnection: ${errorMessage}`);
  }
}

// メッセージ送信関数（モダリティ選択を追加）
async function sendMessage() {
  const messageText = elements.messageInput.value.trim();
  if (!messageText) return;

  if (!isDataChannelReady) {
    console.error("Data channel not ready");
    return;
  }

  try {
    // メッセージをフォーマット
    const userMessage = formatUserMessage(messageText);
    
    // 選択されたモダリティに基づいてレスポンスリクエストを作成
    const selectedModalities = getSelectedModalities();
    if (selectedModalities.length === 0) {
      // 少なくとも1つのモダリティが選択されていることを確認
      showError("少なくとも1つの応答形式（テキストまたは音声）を選択してください");
      return;
    }
    
    const responseRequest = formatResponseRequest(selectedModalities);

    // JSONメッセージとして表示
    const formattedUserMessage = JSON.stringify(userMessage, null, 2);
    addMessage("user", formattedUserMessage);

    // レスポンスリクエストも表示
    const formattedResponseRequest = JSON.stringify(responseRequest, null, 2);
    addMessage("user", formattedResponseRequest);

    try {
      addDebugLog(`Sending message: ${JSON.stringify(userMessage)}`);
      dataChannel.send(JSON.stringify(userMessage));

      // メッセージが処理されるのを少し待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      addDebugLog(`Requesting response with modalities: ${selectedModalities.join(", ")}`);
      dataChannel.send(JSON.stringify(responseRequest));
      addDebugLog("Message and response request sent successfully");
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to send message";
      addDebugLog(`Error sending message: ${errorMsg}`);
      showError(errorMsg);
    }

    // 入力フィールドをクリア
    elements.messageInput.value = "";
    updateSendButtonState();
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Failed to send message";
    console.error("Failed to send message:", err);
    showError(errorMessage);
  }
}