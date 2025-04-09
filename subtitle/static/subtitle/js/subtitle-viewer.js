// 英語字幕ビューアスクリプト

// UI要素の参照
const elements = {
  subtitleContainer: document.getElementById("subtitle-container"),
  subtitleText: document.getElementById("subtitle-text"),
  statusContainer: document.getElementById("status-container"),
  connectionStatus: document.getElementById("connection-status"),
  errorContainer: document.getElementById("error-container"),
  errorMessage: document.getElementById("error-message"),
};

// WebRTC関連の状態変数
let peerConnection = null;
let dataChannel = null;
let isConnected = false;
let isConnecting = false;
let sessionToken = null;
let currentTranscript = ""; // 現在の字幕テキストを保持する変数を追加
let isNewSubtitle = true;   // 新しい字幕表示フラグを追加

// URLパラメータは既にHTML側で取得済み
// ここではHTMLから渡されたmodel変数をそのまま使用

// ログ機能
function logDebug(message) {
  console.log(`[VIEWER-DEBUG] ${message}`);
}

// エラー表示機能
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorContainer.classList.remove("hidden");
  logDebug(`ERROR: ${message}`);
}

function hideError() {
  elements.errorContainer.classList.add("hidden");
}

// 接続状態の表示を更新
function updateConnectionStatus(message) {
  elements.connectionStatus.textContent = message;
  logDebug(`STATUS: ${message}`);
}

// 接続状態表示を非表示にする関数
function hideStatusAfterDelay() {
  setTimeout(() => {
    elements.statusContainer.classList.add("hidden");
    logDebug("Hidden status container after delay");
  }, 1000);
}

// 字幕テキストの更新
function updateSubtitle(text, animate = true) {
  // 新しい字幕の場合はテキストをクリア
  if (isNewSubtitle) {
    logDebug("New subtitle detected, clearing previous subtitle");
    currentTranscript = ""; // 現在の字幕テキストをクリア
    elements.subtitleText.textContent = ""; // 表示をクリア
    isNewSubtitle = false;
    
    // ここで新しい字幕テキストを設定（前の字幕と結合せずに）
    currentTranscript = text;
    elements.subtitleText.textContent = text;
    
    if (animate) {
      // フェードイン効果
      elements.subtitleText.classList.remove("fade-in");
      // リフロー強制
      void elements.subtitleText.offsetWidth;
      elements.subtitleText.classList.add("fade-in");
    }
    
    logDebug(`Updated subtitle text: ${text.substring(0, 30)}...`);
    return; // 新しい字幕の処理が完了したのでここで終了
  }

  // 既存の字幕の更新処理（デルタ追加）
  if (animate) {
    // フェードイン効果
    elements.subtitleText.classList.remove("fade-in");
    // リフロー強制
    void elements.subtitleText.offsetWidth;
    elements.subtitleText.classList.add("fade-in");
  }

  // 前の字幕と結合しないように、currentTranscript に追加のみ行う
  currentTranscript += text;
  elements.subtitleText.textContent = currentTranscript;
  logDebug(`Updated subtitle text: ${currentTranscript.substring(0, 30)}...`);
}

// 字幕テキストをクリア
function clearSubtitle() {
  elements.subtitleText.textContent = "";
  currentTranscript = ""; // 現在の字幕テキストをクリア
  logDebug("Cleared subtitle text");
}

// 字幕完了を処理する関数
function completeSubtitle() {
  // 次の字幕のための新しい字幕フラグを設定
  isNewSubtitle = true;
  logDebug("Subtitle completed, ready for next subtitle");
}

// セッションストレージからトークンを取得する関数
function getTokenFromSessionStorage() {
  try {
    const token = sessionStorage.getItem("subtitleSessionToken");
    if (token) {
      logDebug(
        `Retrieved token from session storage: ${token.substring(0, 10)}...`
      );
      return token;
    } else {
      logDebug("No token found in session storage");
      return null;
    }
  } catch (error) {
    logDebug(`Error accessing session storage: ${error.message}`);
    return null;
  }
}

// リモート記述を取得する
async function getRemoteDescription(offer, token, model) {
  logDebug("Getting remote description...");
  const baseUrl = "https://api.openai.com/v1/realtime";

  logDebug(`Making request to: ${baseUrl}?model=${model}`);

  try {
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
    });

    const responseStatus = sdpResponse.status;
    logDebug(`Remote description response status: ${responseStatus}`);

    if (!sdpResponse.ok) {
      const responseText = await sdpResponse.text();
      logDebug(`Response error (${responseStatus}): ${responseText}`);
      throw new Error(
        `Failed to get remote description: ${responseStatus} - ${responseText}`
      );
    }

    const answer = await sdpResponse.text();
    logDebug("Received answer from OpenAI");
    return answer;
  } catch (error) {
    logDebug(`Error getting remote description: ${error.message}`);
    throw error;
  }
}

// WebRTC初期化関数
async function initializeWebRTC(token) {
  try {
    if (!token) {
      throw new Error("セッショントークンがありません");
    }

    sessionToken = token;
    isConnecting = true;
    updateConnectionStatus("接続中...");
    hideError();

    logDebug(`Using model: ${model}`);
    logDebug(`Token received: ${token.substring(0, 10)}...`);

    // ピア接続の作成
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnection = pc;
    logDebug("Peer connection created");

    // ローカル音声トラックの追加
    logDebug("Getting microphone access...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        logDebug(`Added audio track: ${track.id}`);
      });
      logDebug("Added local audio track");
    } catch (micError) {
      logDebug(`Microphone access error: ${micError.message}`);
      showError(`マイクへのアクセスに失敗しました: ${micError.message}`);
      throw micError;
    }

    // 接続状態の監視
    pc.onconnectionstatechange = () => {
      logDebug(`Connection state changed to: ${pc.connectionState}`);

      if (pc.connectionState === "connected") {
        updateConnectionStatus("接続済み");
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        updateConnectionStatus("接続が切断されました");
        isConnected = false;
      }
    };

    // ICE接続状態の監視
    pc.oniceconnectionstatechange = () => {
      logDebug(`ICE connection state changed to: ${pc.iceConnectionState}`);
    };

    // ICE候補収集状態の監視
    pc.onicegatheringstatechange = () => {
      logDebug(`ICE gathering state changed to: ${pc.iceGatheringState}`);
    };

    // ICE候補の監視
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        logDebug(
          `New ICE candidate: ${event.candidate.candidate.substring(0, 50)}...`
        );
      } else {
        logDebug("ICE gathering complete");
      }
    };

    // データチャネルの設定
    const dc = pc.createDataChannel("oai-events");
    dataChannel = dc;
    logDebug("Data channel created");

    // データチャネルのイベントリスナー追加
    dc.onopen = () => {
      logDebug("Data channel opened");
      updateConnectionStatus("データチャネル接続完了");
      isConnecting = false;
      isConnected = true;

      // セッション作成時に既に指示が適用されているため、追加のリクエストは不要
      updateConnectionStatus("音声入力待機中...");
    };

    dc.onclose = () => {
      logDebug("Data channel closed");
      updateConnectionStatus("データチャネルが閉じられました");
      isConnected = false;
    };

    dc.onerror = (error) => {
      const errorMsg = `データチャネルエラー: ${error.toString()}`;
      logDebug(errorMsg);
      showError(errorMsg);
    };

    // レスポンスの処理
    dc.onmessage = (event) => {
      try {
        // データの概要をログに記録（長いデータは切り詰める）
        const dataPreview =
          event.data.length > 100
            ? `${event.data.substring(0, 100)}...`
            : event.data;
        logDebug(`Received data: ${dataPreview}`);

        // JSONとしてパースを試みる
        const realtimeEvent = JSON.parse(event.data);
        logDebug(`Event type: ${realtimeEvent.type}`);

        // response.text.delta イベント
        if (
          realtimeEvent.type === "response.text.delta" &&
          typeof realtimeEvent.delta === "string"
        ) {
          logDebug(`Received text delta: ${realtimeEvent.delta}`);
          if (realtimeEvent.delta.trim() !== "") {
            updateSubtitle(realtimeEvent.delta, false);
          }
        }
        // response.text.done イベント
        else if (
          realtimeEvent.type === "response.text.done" &&
          typeof realtimeEvent.text === "string"
        ) {
          logDebug(`Received text done: ${realtimeEvent.text}`);
          // 字幕完了を処理
          completeSubtitle();
        }
        // セッション作成完了時に字幕をクリアし、ステータスを更新
        else if (realtimeEvent.type === "session.created") {
          logDebug("Session created, ready to receive audio");
          updateConnectionStatus("セッション作成完了");

          // 字幕を空にする
          clearSubtitle();

          // 1秒後にステータス表示を非表示にする
          hideStatusAfterDelay();
        }
      } catch (error) {
        logDebug(`Error processing message: ${error.message}`);
      }
    };

    // オファーの作成とローカル記述の設定
    logDebug("Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    logDebug(`Local description set: ${offer.sdp.substring(0, 100)}...`);

    // リモート記述を取得して設定
    try {
      const answer = await getRemoteDescription(offer.sdp, token, model);
      const answerSdp = {
        type: "answer",
        sdp: answer,
      };
      await peerConnection.setRemoteDescription(answerSdp);
      logDebug("Remote description set");
      updateConnectionStatus("接続中...");
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to set remote description";
      logDebug(`Error: ${errorMsg}`);
      showError(errorMsg);
      isConnecting = false;
      disconnectConnection();
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "WebRTC初期化エラー";
    logDebug(`Error: ${errorMessage}`);
    showError(errorMessage);
    updateConnectionStatus("接続エラー");
    isConnecting = false;
    isConnected = false;
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
    updateConnectionStatus("切断済み");
    isConnected = false;
    sessionToken = null;
    logDebug("Connection terminated");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "切断エラー";
    showError(errorMessage);
    logDebug(`Error during disconnection: ${errorMessage}`);
  }
}

// 初期化処理 - 自動的にセッションストレージからトークンを取得して接続
function initFromSessionStorage() {
  // セッションストレージからトークンを取得
  const token = getTokenFromSessionStorage();

  if (token) {
    // トークンがあれば初期化を開始
    logDebug("Starting WebRTC with token from session storage");
    initializeWebRTC(token);
  } else {
    // トークンがなければエラーを表示
    logDebug("No token in session storage");
    updateConnectionStatus("セッションが見つかりません");
    showError(
      "セッショントークンが見つかりません。設定画面から開始してください。"
    );
  }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  updateSubtitle("字幕準備中...");
  updateConnectionStatus("接続準備中...");

  // UI要素の存在チェック
  for (const [key, element] of Object.entries(elements)) {
    if (!element) {
      console.error(`UI element not found: ${key}`);
    }
  }

  logDebug("DOM Content Loaded - checking for session token");

  // セッションストレージからの初期化を開始
  initFromSessionStorage();
});
