// 英語字幕クライアントスクリプト

// UI要素の参照
const elements = {
  form: document.getElementById("subtitle-form"),
  connectButton: document.getElementById("connect-button"),
  modelSelect: document.getElementById("model-select"),
  instructionsInput: document.getElementById("instructions-input"),
  backgroundColor: document.getElementById("background-color"),
  textColor: document.getElementById("text-color"),
  fontSize: document.getElementById("font-size"),
  statusContainer: document.getElementById("status-container"),
  status: document.getElementById("status"),
  errorContainer: document.getElementById("error-container"),
  errorMessage: document.getElementById("error-message"),
};

// デバッグ機能
function logDebug(message) {
  console.log(`[CLIENT-DEBUG] ${message}`);
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

// ステータス表示機能
function updateStatus(message) {
  elements.status.textContent = message;
  elements.statusContainer.classList.remove("hidden");
  logDebug(`STATUS: ${message}`);
}

// OpenAIのセッショントークンを取得する
async function getSessionToken(model, instructions) {
  try {
    logDebug(`Requesting session token for model: ${model}`);
    logDebug(`Instructions length: ${instructions.length} characters`);

    // POSTリクエストでセッショントークンを取得
    const tokenResponse = await fetch(`/subtitle/api/session/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": CSRF_TOKEN, // HTML内で定義されたCSRFトークン
      },
      body: JSON.stringify({
        model: model,
        instructions: instructions,
      }),
    });

    // レスポンスのステータスとテキストをログに出力
    logDebug(`Session API response status: ${tokenResponse.status}`);
    const responseText = await tokenResponse.text();
    logDebug(`Session API response text: ${responseText}`);

    // JSONとしてパース
    const data = JSON.parse(responseText);

    if (!tokenResponse.ok) {
      throw new Error(
        `Failed to get session token: ${tokenResponse.status} - ${responseText}`
      );
    }

    if (!data.client_secret?.value) {
      throw new Error("Failed to get valid session token");
    }

    logDebug(
      `Received session token: ${data.client_secret.value.substring(0, 10)}...`
    );
    return data.client_secret.value;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get session token";
    logDebug(`Error: ${errorMessage}`);
    throw error;
  }
}

// 字幕表示ウィンドウを開く関数
function openViewerWindow(options) {
  // パラメータを構築（トークンは含めない）
  const params = new URLSearchParams({
    model: options.model,
    bg: options.backgroundColor,
    textColor: options.textColor,
    fontSize: options.fontSize,
  });

  // 字幕表示ウィンドウを開く
  const viewerURL = `/subtitle/viewer/?${params.toString()}`;
  logDebug(`Opening viewer window with URL: ${viewerURL}`);

  const viewerWindow = window.open(
    viewerURL,
    "subtitleViewer",
    "width=800,height=400,location=no,menubar=no,toolbar=no,status=no"
  );

  if (!viewerWindow) {
    throw new Error(
      "ポップアップがブロックされました。この機能を使用するにはポップアップを許可してください。"
    );
  }

  return viewerWindow;
}

// セッションストレージにトークンを保存する関数
function storeTokenInSessionStorage(token) {
  try {
    // セッションストレージにトークンを保存
    sessionStorage.setItem("subtitleSessionToken", token);
    logDebug("Stored token in session storage");
    return true;
  } catch (error) {
    logDebug(`Error storing token in session storage: ${error.message}`);
    return false;
  }
}

// 字幕表示を開始する
async function startSubtitle() {
  try {
    hideError();
    updateStatus("接続中...");

    // フォーム入力を取得
    const model = elements.modelSelect.value;
    const instructions = elements.instructionsInput.value;
    const backgroundColor = elements.backgroundColor.value;
    const textColor = elements.textColor.value;
    const fontSize = elements.fontSize.value;

    logDebug(`Using model: ${model}`);
    logDebug(`Instructions: ${instructions}`);
    logDebug(
      `Colors - bg: ${backgroundColor}, text: ${textColor}, size: ${fontSize}`
    );

    try {
      // セッショントークンを取得
      updateStatus("セッショントークンを取得中...");
      const sessionToken = await getSessionToken(model, instructions);
      updateStatus("セッショントークン取得完了");

      // セッションストレージにトークンを保存
      if (!storeTokenInSessionStorage(sessionToken)) {
        showError(
          "トークンの保存に失敗しました。プライベートブラウジングモードを使用している場合は無効にしてください。"
        );
        return;
      }

      // トークンを保存したら字幕表示ウィンドウを開く
      const viewerWindow = openViewerWindow({
        model,
        instructions,
        backgroundColor,
        textColor,
        fontSize,
      });

      updateStatus(
        "字幕表示ウィンドウを開きました。音声入力の許可を求められたら許可してください。"
      );
    } catch (error) {
      showError(`エラー: ${error.message}`);
      updateStatus("接続に失敗しました");
    }
  } catch (error) {
    showError(`エラー: ${error.message}`);
    updateStatus("接続に失敗しました");
  }
}

// イベントリスナーの設定
document.addEventListener("DOMContentLoaded", () => {
  // UI要素の存在チェック
  for (const [key, element] of Object.entries(elements)) {
    if (!element) {
      console.error(`UI element not found: ${key}`);
    }
  }

  logDebug("DOM Content Loaded - initializing subtitle client");

  // 接続ボタン
  elements.connectButton.addEventListener("click", () => {
    logDebug("Connect button clicked");
    startSubtitle();
  });

  // フォーム送信のデフォルト動作を防止
  elements.form.addEventListener("submit", (e) => {
    e.preventDefault();
    logDebug("Form submission prevented");
    return false;
  });

  logDebug("Event listeners set up");
});
