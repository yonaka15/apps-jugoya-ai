// API通信関連の関数

// OpenAIのセッショントークンを取得する
async function getSessionToken(model) {
  try {
    addDebugLog(`Requesting session token for model: ${model}...`);
    const tokenResponse = await fetch(
      `/translator/api/session/?model=${encodeURIComponent(model)}`
    );

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
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get session token";
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
      throw new Error(
        `Failed to get remote description: ${sdpResponse.status} - ${responseText}`
      );
    }

    addDebugLog("Response is OK, getting SDP answer...");
    addDebugLog("Received answer from OpenAI");
    return await sdpResponse.text();
  } catch (error) {
    addDebugLog(`Error getting remote description: ${error.message}`);
    throw error;
  }
}

// リクエストフォーマット関連の関数
/**
 * ユーザーメッセージをフォーマットする関数
 * @param {string} message - ユーザーメッセージ
 * @return {object} フォーマットされたメッセージオブジェクト
 * */
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

/**
 * レスポンスリクエストをフォーマットする関数
 * @param {Array<string>} modalities - モダリティの配列（例: ["text", "audio"]）
 * @param {string} instructions - インストラクション（オプション）
 * @return {object} フォーマットされたレスポンスリクエストオブジェクト
 * */
function formatResponseRequest(
  modalities = ["text"], // text, audio
  instructions = undefined
) {
  return {
    type: "response.create",
    response: {
      modalities,
      instructions,
    },
  };
}

/**
 * セッション更新リクエストをフォーマットする関数（モダリティ対応を追加）
 * @param {string} voice - 音声モデル名
 * @param {string} instructions - 指示文（オプション）
 * @param {Array<string>} modalities - モダリティの配列（オプション）
 * @return {object} フォーマットされたセッション更新リクエストオブジェクト
 * */
function formatSessionUpdateRequest(voice, instructions = undefined, modalities = undefined) {
  // セッション更新オブジェクトの初期化
  const session = {
    voice,
  };
  
  // 指示文がある場合は追加
  if (instructions !== undefined) {
    session.instructions = instructions;
  }
  
  // モダリティが指定されている場合は追加
  if (modalities !== undefined && Array.isArray(modalities) && modalities.length > 0) {
    session.modalities = modalities;
  }
  
  return {
    type: "session.update",
    session,
  };
}
