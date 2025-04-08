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
  connectButton: document.getElementById("connect-button"),
  disconnectButton: document.getElementById("disconnect-button"),
  modelSelect: document.getElementById("model-select"),
  voiceSelect: document.getElementById("voice-select"), // 新規追加
  instructionsInput: document.getElementById("instructions-input"), // 新規追加：指示文入力欄
  audioCheckbox: document.getElementById("audio-checkbox"), // 音声応答チェックボックス
  updateSessionButton: document.getElementById("update-session-button"), // 新規追加
  updateStatus: document.getElementById("update-status"), // 新規追加
  status: document.getElementById("status"),
  dataChannelStatus: document.getElementById("data-channel-status"),
  errorContainer: document.getElementById("error-container"),
  errorMessage: document.getElementById("error-message"),
  messagesContainer: document.getElementById("messages-container"),
  messagesEnd: document.getElementById("messages-end"),
  // 新規追加: Response Textコンテナの参照
  responseTextContainer: document.getElementById("response-text-container"),
  responseTextContent: document.getElementById("response-text-content"),
  responseTextEnd: document.getElementById("response-text-end"),
  transcriptsContainer: document.getElementById("transcripts-container"),
  transcriptsEnd: document.getElementById("transcripts-end"),
  messageInput: document.getElementById("message-input"),
  sendButton: document.getElementById("send-button"),
  debugLogContainer: document.getElementById("debug-log-container"),
  debugLogEnd: document.getElementById("debug-log-end"),
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
let isUpdatingSession = false; // 新規追加：セッション更新中フラグ
let currentSessionToken = null;
let currentModel = null;
let currentVoice = "verse"; // 新規追加：現在の音声モデル
let currentInstructions = ""; // 新規追加：現在の指示文
// 新規追加: 現在のレスポンステキストを追跡する変数
let currentResponseText = "";
let isNewResponse = true;

// 変更: 音声トランスクリプト用の状態変数を追加
let currentTranscriptText = "";
let isNewTranscript = true;

// スクロール関連の関数
function scrollToBottom(element) {
  if (element) {
    element.scrollIntoView({ behavior: "smooth" });
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

  const logElement = document.createElement("p");
  logElement.className = "text-sm font-mono mb-1";
  logElement.textContent = logEntry;

  elements.debugLogContainer.insertBefore(logElement, elements.debugLogEnd);
  scrollContainerToBottom(elements.debugLogEnd);
}

// 変更: トランスクリプトのデルタ更新用関数
function updateTranscriptText(delta) {
  // 新しいトランスクリプトの場合はテキストをクリア
  if (isNewTranscript) {
    addDebugLog("Clearing transcript text area for new transcript");
    currentTranscriptText = "";
    // 古いトランスクリプト表示をクリアするのではなく、新しい要素を追加
    const transcriptElement = document.createElement("div");
    transcriptElement.className = "mb-2 last:mb-0 transcript-item";
    transcriptElement.id = "current-transcript";

    const textElement = document.createElement("p");
    textElement.className = "text-purple-800 transcript-content";
    textElement.textContent = "";

    transcriptElement.appendChild(textElement);
    elements.transcriptsContainer.insertBefore(
      transcriptElement,
      elements.transcriptsEnd
    );
    // 新しいトランスクリプトの処理を始めたので、フラグをfalseに設定
    isNewTranscript = false;
  }
  
  // デルタをテキストに追加
  currentTranscriptText += delta;
  
  // 現在のトランスクリプト要素を更新
  const currentElement = document.getElementById("current-transcript");
  if (currentElement) {
    const contentElement = currentElement.querySelector(".transcript-content");
    if (contentElement) {
      contentElement.textContent = currentTranscriptText;
    }
  }
  
  // 自動スクロール
  scrollContainerToBottom(elements.transcriptsEnd);
  
  // デバッグログに現在の状態を出力
  addDebugLog(`Current transcript text: (${currentTranscriptText.length} chars)`);
}

// 変更: 完了したトランスクリプトを処理する関数
function completeTranscriptText() {
  // IDをリセットして新しいトランスクリプト用に準備
  const currentElement = document.getElementById("current-transcript");
  if (currentElement) {
    currentElement.id = "";
  }
  
  // トランスクリプト配列に追加
  transcripts.push(currentTranscriptText);
  
  // 次のトランスクリプトのために新しいトランスクリプトフラグを設定
  isNewTranscript = true;
  addDebugLog("Transcript text completed");
}

// 変更: トランスクリプトを追加する関数 (完全なテキスト用のレガシーサポート)
function addTranscript(text) {
  transcripts.push(text);

  const transcriptElement = document.createElement("div");
  transcriptElement.className = "mb-2 last:mb-0";

  const textElement = document.createElement("p");
  textElement.className = "text-purple-800";
  textElement.textContent = text;

  transcriptElement.appendChild(textElement);
  elements.transcriptsContainer.insertBefore(
    transcriptElement,
    elements.transcriptsEnd
  );
  scrollContainerToBottom(elements.transcriptsEnd);
}

// メッセージを追加する関数（修正版）
function addMessage(role, content) {
  const message = new Message(role, content);
  messages.push(message);

  const messageElement = document.createElement("div");
  messageElement.className = `mb-4 ${
    role === "user" ? "text-right" : "text-left"
  }`;

  const bubbleElement = document.createElement("div");
  bubbleElement.className = `message-bubble inline-block max-w-[95%] rounded-lg px-4 py-2 ${
    role === "user" ? "bg-blue-500 text-white" : "bg-white border"
  }`;

  const contentElement = document.createElement("p");

  // JSONデータとして整形するか判断
  const isJsonContent =
    role === "assistant" &&
    // JSONオブジェクトまたは配列の形式をチェック
    ((content.trim().startsWith("{") && content.trim().endsWith("}")) ||
      (content.trim().startsWith("[") && content.trim().endsWith("]")) ||
      // 「送信されたメッセージのJSON形式」などのプレフィックスを持つメッセージ
      content.includes("JSON形式"));

  if (isJsonContent) {
    // JSONデータはプリフォーマットテキストとして表示
    const pre = document.createElement("pre");
    pre.className = "whitespace-pre-wrap text-xs font-mono overflow-x-auto break-words";
    pre.textContent = content;
    contentElement.appendChild(pre);
  } else {
    // 通常のテキストとして表示
    contentElement.textContent = content;
    contentElement.className = `${role === "user" ? "text-white" : "text-gray-800"} break-words`;
  }

  const timeElement = document.createElement("p");
  timeElement.className = "text-xs mt-1 opacity-50";
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
  if (
    messages.length > 0 &&
    messages[messages.length - 1].role === "assistant"
  ) {
    // 最後のメッセージがアシスタントのものなら内容を置き換え（JSONの場合は追加ではなく置き換え）
    const lastMessage = messages[messages.length - 1];
    lastMessage.content = delta; // '+='から'='に変更して、JSONオブジェクト全体を表示

    // DOMを更新
    const lastBubble =
      elements.messagesContainer.lastChild.querySelector("div p:first-child");
    if (lastBubble) {
      // テキストコンテンツとして設定するのではなく、innerHTMLを使用して整形を保持
      lastBubble.innerHTML = ""; // 内容をクリア

      // コードブロックとして表示
      const pre = document.createElement("pre");
      pre.className = "whitespace-pre-wrap text-xs font-mono overflow-x-auto break-words";
      pre.textContent = lastMessage.content;
      lastBubble.appendChild(pre);
    }

    scrollToBottom(elements.messagesEnd);
  } else {
    // 新しいアシスタントメッセージを作成
    // メッセージの追加方法も変更
    const message = new Message("assistant", delta);
    messages.push(message);

    const messageElement = document.createElement("div");
    messageElement.className = "mb-4 text-left";

    const bubbleElement = document.createElement("div");
    bubbleElement.className =
      "message-bubble inline-block max-w-[95%] rounded-lg px-4 py-2 bg-white border";

    const contentElement = document.createElement("p");

    // コードブロックとして表示
    const pre = document.createElement("pre");
    pre.className = "whitespace-pre-wrap text-xs font-mono overflow-x-auto break-words";
    pre.textContent = delta;
    contentElement.appendChild(pre);

    const timeElement = document.createElement("p");
    timeElement.className = "text-xs mt-1 opacity-50";
    timeElement.textContent = message.timestamp.toLocaleTimeString();

    bubbleElement.appendChild(contentElement);
    bubbleElement.appendChild(timeElement);
    messageElement.appendChild(bubbleElement);

    elements.messagesContainer.insertBefore(
      messageElement,
      elements.messagesEnd
    );
    scrollToBottom(elements.messagesEnd);
  }
}

// エラー表示関数
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorContainer.classList.remove("hidden");
}

function hideError() {
  elements.errorContainer.classList.add("hidden");
}

// 状態表示の更新
function updateStatus(status) {
  elements.status.textContent = status;
  elements.status.className =
    status === "Disconnected"
      ? "status-disconnected"
      : status === "Error"
      ? "status-error"
      : status === "Updating Session..."
      ? "status-updating"
      : "status-connected";
}

// データチャネル状態の更新
function updateDataChannelStatus(isReady) {
  isDataChannelReady = isReady;
  elements.dataChannelStatus.textContent = `Data Channel: ${
    isReady ? "Ready" : "Not Ready"
  }`;
  elements.dataChannelStatus.className = isReady
    ? "data-channel-ready"
    : "data-channel-not-ready";

  // 入力フィールドとボタンの有効/無効を切り替え
  elements.messageInput.disabled = !isReady;
  elements.updateSessionButton.disabled = !isReady; // 新規追加：セッション更新ボタンの有効/無効
  
  // 変更: データチャネルの状態に関わらず、接続前から設定可能にする
  // これらの要素は接続ボタンクリック時に無効化され、接続確立後に再度有効化される
  if (!isConnecting) {
    elements.voiceSelect.disabled = false;
    elements.instructionsInput.disabled = false;
    elements.audioCheckbox.disabled = false;
  } else {
    // 接続中は無効化
    elements.voiceSelect.disabled = true;
    elements.instructionsInput.disabled = true;
    elements.audioCheckbox.disabled = true;
  }
  
  updateSendButtonState();
}

// 送信ボタンの状態更新
function updateSendButtonState() {
  elements.sendButton.disabled =
    !isDataChannelReady || !elements.messageInput.value.trim();
}

// モダリティ選択機能（シンプル化）
/**
 * 選択されたモダリティを取得する関数
 * @return {string[]} 選択されたモダリティの配列（"text", "audio"）
 */
function getSelectedModalities() {
  // テキストは常に含める（APIの制約に対応）
  const modalities = ["text"];
  
  // 音声チェックボックスがオンの場合は音声も追加
  if (elements.audioCheckbox.checked) {
    modalities.push("audio");
  }
  
  return modalities;
}

// 新規追加: レスポンステキストを更新する関数（修正版）
function updateResponseText(delta) {
  // 新しいレスポンスの場合はテキストをクリア
  if (isNewResponse) {
    addDebugLog("Clearing response text area for new response");
    currentResponseText = "";
    elements.responseTextContent.textContent = "";
    // 新しいレスポンスの処理を始めたので、フラグをfalseに設定
    isNewResponse = false;
  }
  
  // デルタをテキストに追加
  currentResponseText += delta;
  elements.responseTextContent.textContent = currentResponseText;
  
  // 自動スクロール
  scrollContainerToBottom(elements.responseTextEnd);
  
  // デバッグログに現在の状態を出力
  addDebugLog(`Current response text: (${currentResponseText.length} chars)`);
}

// 新規追加: レスポンスの完了を処理する関数
function completeResponseText() {
  // 次のレスポンスのために新しいレスポンスフラグを設定
  isNewResponse = true;
  addDebugLog("Response text completed");
}

// チェックボックスのイベントリスナーを追加する関数
function setupModalityCheckboxes() {
  // 音声応答チェックボックスのイベントリスナー
  // シンプル化されたバージョンでは追加の調整は不要
  elements.audioCheckbox.addEventListener("change", function() {
    addDebugLog(`Audio response setting changed to: ${this.checked ? 'enabled' : 'disabled'}`);
  });
}

// 初期化時にUI要素の状態を設定する関数
function initializeUIState() {
  // 接続前から設定可能にする
  elements.voiceSelect.disabled = false;
  elements.instructionsInput.disabled = false;
  elements.audioCheckbox.disabled = false;
  
  // 現在の設定を保存
  currentVoice = elements.voiceSelect.value;
  currentInstructions = elements.instructionsInput.value;
  
  addDebugLog("UI initialized for pre-connection configuration");
}

// ページロード時にUIの初期状態を設定
document.addEventListener("DOMContentLoaded", initializeUIState);