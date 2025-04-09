// イベントリスナーの設定
document.addEventListener("DOMContentLoaded", () => {
  // 接続前の設定入力を有効化
  initializeUIState();
  
  // 接続ボタン
  elements.connectButton.addEventListener("click", initializeWebRTC);

  // 切断ボタン
  elements.disconnectButton.addEventListener("click", disconnectConnection);

  // セッション更新ボタン
  elements.updateSessionButton.addEventListener("click", updateSession);

  // メッセージ入力フィールド
  elements.messageInput.addEventListener("input", updateSendButtonState);
  elements.messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // 送信ボタン
  elements.sendButton.addEventListener("click", sendMessage);
  
  // モダリティチェックボックスのセットアップ
  setupModalityCheckboxes();
});

// ページを離れるときにクリーンアップ
window.addEventListener("beforeunload", () => {
  if (isConnected) {
    disconnectConnection();
  }
});
