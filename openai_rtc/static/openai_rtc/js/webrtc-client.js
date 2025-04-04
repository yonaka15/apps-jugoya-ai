// メッセージとUI要素の型定義
class Message {
  constructor(role, content, timestamp = new Date()) {
    this.role = role; // "assistant" | "user"
    this.content = content;
    this.timestamp = timestamp;
  }
}

// UI要素の参照
const elements = {
  connectButton: document.getElementById('connect-button'),
  disconnectButton: document.getElementById('disconnect-button'),
  modelSelect: document.getElementById('model-select'),
  status: document.getElementById('status'),
  dataChannelStatus: document.getElementById('data-channel-status'),
  errorContainer: document.getElementById('error-container'),
  errorMessage: document.getElementById('error-message'),
  messagesContainer: document.getElementById('messages-container'),
  messagesEnd: document.getElementById('messages-end'),
  transcriptsContainer: document.getElementById('transcripts-container'),
  transcriptsEnd: document.getElementById('transcripts-end'),
  messageInput: document.getElementById('message-input'),
  sendButton: document.getElementById('send-button'),
  debugLogContainer: document.getElementById('debug-log-container'),
  debugLogEnd: document.getElementById('debug-log-end'),
};

// WebRTC関連の状態変数
let peerConnection = null;
let dataChannel = null;
let messages = [];
let debugLog = [];
let transcripts = [];
let isDataChannelReady = false;
let isConnected = false;
let isConnecting = false;
let currentSessionToken = null;
let currentModel = null;

// スクロール関連の関数
function scrollToBottom(element) {
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

function scrollContainerToBottom(container) {
  if (container) {
    const containerElement = container.parentElement;
    if (containerElement) {
      containerElement.scrollTop = containerElement.scrollHeight;
    }
  }
}

// デバッグログを追加する関数
function addDebugLog(message) {
  console.log(message);
  const logEntry = `${new Date().toISOString()}: ${message}`;
  debugLog.push(logEntry);
  
  const logElement = document.createElement('p');
  logElement.className = 'text-sm font-mono mb-1';
  logElement.textContent = logEntry;
  
  elements.debugLogContainer.insertBefore(logElement, elements.debugLogEnd);
  scrollContainerToBottom(elements.debugLogEnd);
}

// トランスクリプトを追加する関数
function addTranscript(text) {
  transcripts.push(text);
  
  const transcriptElement = document.createElement('div');
  transcriptElement.className = 'mb-2 last:mb-0';
  
  const textElement = document.createElement('p');
  textElement.className = 'text-purple-800';
  textElement.textContent = text;
  
  transcriptElement.appendChild(textElement);
  elements.transcriptsContainer.insertBefore(transcriptElement, elements.transcriptsEnd);
  scrollContainerToBottom(elements.transcriptsEnd);
}

// メッセージを追加する関数
function addMessage(role, content) {
  const message = new Message(role, content);
  messages.push(message);
  
  const messageElement = document.createElement('div');
  messageElement.className = `mb-4 ${role === 'user' ? 'text-right' : 'text-left'}`;
  
  const bubbleElement = document.createElement('div');
  bubbleElement.className = `inline-block max-w-[70%] rounded-lg px-4 py-2 ${
    role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border'
  }`;
  
  const contentElement = document.createElement('p');
  
  // JSONデータとして整形するか判断
  const isJsonContent = role === 'assistant' && 
    (content.trim().startsWith('{') || content.trim().startsWith('['));
  
  if (isJsonContent) {
    // JSONデータはプリフォーマットテキストとして表示
    const pre = document.createElement('pre');
    pre.className = 'whitespace-pre-wrap text-xs font-mono overflow-x-auto';
    pre.textContent = content;
    contentElement.appendChild(pre);
  } else {
    // 通常のテキストとして表示
    contentElement.textContent = content;
    contentElement.className = role === 'user' ? 'text-white' : 'text-gray-800';
  }
  
  const timeElement = document.createElement('p');
  timeElement.className = 'text-xs mt-1 opacity-50';
  timeElement.textContent = message.timestamp.toLocaleTimeString();
  
  bubbleElement.appendChild(contentElement);
  bubbleElement.appendChild(timeElement);
  messageElement.appendChild(bubbleElement);
  
  elements.messagesContainer.insertBefore(messageElement, elements.messagesEnd);
  scrollToBottom(elements.messagesEnd);
  
  return message;
}

// アシスタントメッセージの更新関数
function updateAssistantMessage(delta) {
  if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
    // 最後のメッセージがアシスタントのものなら内容を置き換え（JSONの場合は追加ではなく置き換え）
    const lastMessage = messages[messages.length - 1];
    lastMessage.content = delta; // '+='から'='に変更して、JSONオブジェクト全体を表示
    
    // DOMを更新
    const lastBubble = elements.messagesContainer.lastChild.querySelector('div p:first-child');
    if (lastBubble) {
      // テキストコンテンツとして設定するのではなく、innerHTMLを使用して整形を保持
      lastBubble.innerHTML = ''; // 内容をクリア
      
      // コードブロックとして表示
      const pre = document.createElement('pre');
      pre.className = 'whitespace-pre-wrap text-xs font-mono overflow-x-auto';
      pre.textContent = lastMessage.content;
      lastBubble.appendChild(pre);
    }
    
    scrollToBottom(elements.messagesEnd);
  } else {
    // 新しいアシスタントメッセージを作成
    // メッセージの追加方法も変更
    const message = new Message('assistant', delta);
    messages.push(message);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'mb-4 text-left';
    
    const bubbleElement = document.createElement('div');
    bubbleElement.className = 'inline-block max-w-[70%] rounded-lg px-4 py-2 bg-white border';
    
    const contentElement = document.createElement('p');
    
    // コードブロックとして表示
    const pre = document.createElement('pre');
    pre.className = 'whitespace-pre-wrap text-xs font-mono overflow-x-auto';
    pre.textContent = delta;
    contentElement.appendChild(pre);
    
    const timeElement = document.createElement('p');
    timeElement.className = 'text-xs mt-1 opacity-50';
    timeElement.textContent = message.timestamp.toLocaleTimeString();
    
    bubbleElement.appendChild(contentElement);
    bubbleElement.appendChild(timeElement);
    messageElement.appendChild(bubbleElement);
    
    elements.messagesContainer.insertBefore(messageElement, elements.messagesEnd);
    scrollToBottom(elements.messagesEnd);
  }
}

// エラー表示関数
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorContainer.classList.remove('hidden');
}

function hideError() {
  elements.errorContainer.classList.add('hidden');
}

// 状態表示の更新
function updateStatus(status) {
  elements.status.textContent = status;
  elements.status.className = 
    status === 'Disconnected' ? 'status-disconnected' :
    status === 'Error' ? 'status-error' : 'status-connected';
}

// データチャネル状態の更新
function updateDataChannelStatus(isReady) {
  isDataChannelReady = isReady;
  elements.dataChannelStatus.textContent = `Data Channel: ${isReady ? 'Ready' : 'Not Ready'}`;
  elements.dataChannelStatus.className = isReady ? 'data-channel-ready' : 'data-channel-not-ready';
  
  // 入力フィールドとボタンの有効/無効を切り替え
  elements.messageInput.disabled = !isReady;
  updateSendButtonState();
}

// 送信ボタンの状態更新
function updateSendButtonState() {
  elements.sendButton.disabled = !isDataChannelReady || !elements.messageInput.value.trim();
}

// OpenAIのセッショントークンを取得する
async function getSessionToken(model) {
  try {
    addDebugLog(`Requesting session token for model: ${model}...`);
    const tokenResponse = await fetch(`/openai_rtc/api/session/?model=${encodeURIComponent(model)}`);
    
    if (!tokenResponse.ok) {
      throw new Error(`Failed to get session token: ${tokenResponse.status}`);
    }
    
    const data = await tokenResponse.json();
    
    if (!data.client_secret?.value) {
      throw new Error("Failed to get valid session token");
    }
    
    addDebugLog("Received session token");
    return data.client_secret.value;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to get session token";
    addDebugLog(`Error: ${errorMessage}`);
    throw error;
  }
}

// リモート記述を取得する
async function getRemoteDescription(offer, token, model) {
  addDebugLog("Getting remote description...");
  const baseUrl = "https://api.openai.com/v1/realtime";

  addDebugLog(`Making request to: ${baseUrl}?model=${model}`);
  addDebugLog(`Using offer SDP: ${offer.slice(0, 100)}...`);

  try {
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!sdpResponse.ok) {
      const responseText = await sdpResponse.text();
      addDebugLog(`Response error (${sdpResponse.status}): ${responseText}`);
      throw new Error(`Failed to get remote description: ${sdpResponse.status} - ${responseText}`);
    }

    addDebugLog("Response is OK, getting SDP answer...");
    addDebugLog("Received answer from OpenAI");
    return await sdpResponse.text();
  } catch (error) {
    addDebugLog(`Error getting remote description: ${error.message}`);
    throw error;
  }
}

// メッセージをフォーマットする
function formatUserMessage(message) {
  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [
        {
          type: "input_text",
          text: message,
        },
      ],
    },
  };
}

function formatResponseRequest() {
  return {
    type: "response.create",
    response: {
      modalities: ["text"],
    },
  };
}

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

    dc.onmessage = (event) => {
      // まずは受信したデータをデバッグログに追加（生データ）
      addDebugLog(`Received raw data: ${event.data}`);
      
      try {
        // JSONとしてパースを試みる
        const realtimeEvent = JSON.parse(event.data);
        addDebugLog(`Parsed event: ${JSON.stringify(realtimeEvent)}`);

        // 重要なイベントタイプのみを表示（response.doneとsession.created、およびユーザーからのコマンドメッセージ）
        const importantEventTypes = [
          "response.done", 
          "session.created"
        ];
        
        if (importantEventTypes.includes(realtimeEvent.type)) {
          // 重要なイベントはJSONとして整形して表示
          const formattedData = JSON.stringify(realtimeEvent, null, 2);
          addMessage('assistant', formattedData);
        }
        // トランスクリプトイベントは従来通り処理
        else if (realtimeEvent.type === "response.audio_transcript.done" && typeof realtimeEvent.transcript === "string") {
          addTranscript(realtimeEvent.transcript);
        }
        // その他のイベントはデバッグログにのみ記録し、UIには表示しない
      } catch (error) {
        // JSONのパースに失敗した場合は、デバッグログにエラーを記録
        addDebugLog(`Error parsing event: ${error}`);
        // パースエラーの場合は重要なので、UIにも表示
        addMessage('assistant', `[Parse Error] Raw data: ${event.data}`);
      }
    };

    // オファーの作成とローカル記述の設定
    addDebugLog("Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    addDebugLog("Local description set");

    // リモート記述を取得して設定
    try {
      const answer = await getRemoteDescription(offer.sdp, token, selectedModel);
      const answerSdp = {
        type: "answer",
        sdp: answer
      };
      await peerConnection.setRemoteDescription(answerSdp);
      addDebugLog("Remote description set");
      updateStatus("Connecting...");
    } catch (error) {
      const errorMsg = error instanceof Error
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
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Failed to disconnect properly";
    showError(errorMessage);
    addDebugLog(`Error during disconnection: ${errorMessage}`);
  }
}

// メッセージ送信関数
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
    const responseRequest = formatResponseRequest();
    
    // ユーザーメッセージは元のテキストをそのまま表示
    addMessage("user", messageText);
    
    // デバッグ用にフォーマットされたJSONもログに記録
    const formattedUserMessage = JSON.stringify(userMessage, null, 2);
    addDebugLog(`Sending formatted message: ${formattedUserMessage}`);
    
    try {
      addDebugLog(`Sending message: ${JSON.stringify(userMessage)}`);
      dataChannel.send(JSON.stringify(userMessage));

      // メッセージが処理されるのを少し待つ
      await new Promise((resolve) => setTimeout(resolve, 100));

      addDebugLog(`Requesting response: ${JSON.stringify(responseRequest)}`);
      dataChannel.send(JSON.stringify(responseRequest));
      addDebugLog("Message and response request sent successfully");
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : "Failed to send message";
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

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
  // 接続ボタン
  elements.connectButton.addEventListener('click', initializeWebRTC);
  
  // 切断ボタン
  elements.disconnectButton.addEventListener('click', disconnectConnection);
  
  // メッセージ入力フィールド
  elements.messageInput.addEventListener('input', updateSendButtonState);
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
  
  // 送信ボタン
  elements.sendButton.addEventListener('click', sendMessage);
});

// ページを離れるときにクリーンアップ
window.addEventListener('beforeunload', () => {
  if (isConnected) {
    disconnectConnection();
  }
});