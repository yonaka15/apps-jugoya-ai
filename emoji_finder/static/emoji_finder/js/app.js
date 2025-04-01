/**
 * 絵文字検索アプリケーションの JavaScript
 */
document.addEventListener('DOMContentLoaded', function() {
  // DOM要素
  const searchInput = document.getElementById('search-query');
  const searchButton = document.getElementById('search-button');
  const errorMessage = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  const loadingIndicator = document.getElementById('loading-indicator');
  const resultsContainer = document.getElementById('results-container');
  const resultsHeading = document.getElementById('results-heading');
  const resultsCount = document.getElementById('results-count');
  const emojiResults = document.getElementById('emoji-results');
  const noResults = document.getElementById('no-results');

  // モーダル要素
  const modal = document.getElementById('emoji-modal');
  const modalImage = document.getElementById('modal-image');
  const modalDetails = document.getElementById('modal-details');
  const closeButton = document.querySelector('.close-button');

  // 検索結果を保存する変数
  let currentSearchResults = [];
  let currentQuery = '';

  // 検索ボタンのイベントリスナー
  searchButton.addEventListener('click', performSearch);

  // Enter キーでも検索できるようにする
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      performSearch();
    }
  });

  // モーダルを閉じるボタンのイベントリスナー
  closeButton.addEventListener('click', closeModal);

  // モーダルの外側をクリックしたら閉じる
  window.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeModal();
    }
  });

  // ESCキーでモーダルを閉じる
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.style.display === 'block') {
      closeModal();
    }
  });

  /**
   * 検索を実行する
   */
  function performSearch() {
    const query = searchInput.value.trim();
    
    // 検索クエリが空の場合はエラーを表示
    if (!query) {
      showError('検索キーワードを入力してください。');
      return;
    }

    // UI状態をリセットして検索中の状態にする
    resetUI();
    setSearchingState(true);
    
    // CSRF トークンを取得
    const csrfToken = getCookie('csrftoken');
    
    // 検索リクエスト
    fetch(`/emoji_finder/query/?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken
      }
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || `ステータスコード ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      // 検索結果をグローバル変数に保存
      currentSearchResults = data.emojis || [];
      currentQuery = data.query || query;
      
      // 検索結果を表示
      displayResults(data);
    })
    .catch(error => {
      showError(`検索中にエラーが発生しました: ${error.message}`);
    })
    .finally(() => {
      // 検索中状態を解除
      setSearchingState(false);
    });
  }

  /**
   * 検索中の状態を設定する
   * @param {boolean} isSearching - 検索中かどうか
   */
  function setSearchingState(isSearching) {
    if (isSearching) {
      // 検索ボタンを非アクティブにする
      searchButton.disabled = true;
      searchButton.classList.add('button-disabled');
      searchInput.disabled = true;
      
      // ローディングインジケータを表示
      loadingIndicator.style.display = 'block';
    } else {
      // 検索ボタンをアクティブに戻す
      searchButton.disabled = false;
      searchButton.classList.remove('button-disabled');
      searchInput.disabled = false;
      
      // ローディングインジケータを非表示
      loadingIndicator.style.display = 'none';
    }
  }

  /**
   * 検索結果を表示する
   * @param {Object} data - APIからのレスポンスデータ
   */
  function displayResults(data) {
    // エラーチェック
    if (data.error) {
      showError(data.error);
      return;
    }
    
    // 結果コンテナを表示
    resultsContainer.style.display = 'block';
    
    // 検索クエリを表示
    resultsHeading.textContent = `検索結果: "${data.query}"`;
    
    // 絵文字が見つからない場合
    if (!data.emojis || data.emojis.length === 0) {
      noResults.style.display = 'block';
      return;
    }
    
    // 結果の件数を表示
    resultsCount.innerHTML = `<p>${data.emojis.length}件の結果が見つかりました</p>`;
    
    // 絵文字結果をクリア
    emojiResults.innerHTML = '';
    
    // 各絵文字のカードを作成
    data.emojis.forEach((emoji, index) => {
      const emojiCard = document.createElement('div');
      emojiCard.className = 'emoji-card';
      emojiCard.dataset.index = index; // インデックスを記録
      
      // Unicode値からファイル名を抽出
      const codePoint = emoji.metadata.filename.replace(/\.[^/.]+$/, ""); // 拡張子を削除
      const nameFromCode = codePoint.replace('U+', '');
      
      // 実際のHTML作成
      emojiCard.innerHTML = `
        <div class="emoji-container">
          <img src="${emoji.metadata.url}" alt="${nameFromCode}">
        </div>
        <div class="emoji-details">
          <h3 class="emoji-name">${nameFromCode}</h3>
          <p class="similarity">類似度: ${(emoji.similarity * 100).toFixed(1)}%</p>
        </div>
      `;
      
      // クリックイベントでモーダルを開く
      emojiCard.addEventListener('click', function() {
        openEmojiModal(index);
      });
      
      emojiResults.appendChild(emojiCard);
    });
  }

  /**
   * 絵文字モーダルを開く
   * @param {number} index - 絵文字のインデックス
   */
  function openEmojiModal(index) {
    const emoji = currentSearchResults[index];
    if (!emoji) return;
    
    // Unicode値からファイル名を抽出
    const codePoint = emoji.metadata.filename.replace(/\.[^/.]+$/, ""); // 拡張子を削除
    const nameFromCode = codePoint.replace('U+', '');
    
    // モーダル画像を設定
    modalImage.src = emoji.metadata.url;
    modalImage.alt = nameFromCode;
    
    // 日時をフォーマット
    const timestamp = new Date(emoji.metadata.timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // モーダル詳細情報を設定
    modalDetails.innerHTML = `
      <h3>絵文字コード: ${nameFromCode}</h3>
      <p class="similarity">類似度: ${(emoji.similarity * 100).toFixed(1)}%</p>
      <p class="format">形式: ${emoji.metadata.original_format}</p>
      <p class="timestamp">タイムスタンプ: ${timestamp}</p>
      <p class="model">モデル: ${emoji.metadata.model}</p>
      <button id="copy-image-button" class="copy-button">画像をコピー</button>
      <p id="copy-status" class="copy-status" style="display: none;">コピーしました！</p>
    `;
    
    // コピーボタンにイベントリスナーを追加
    const copyButton = document.getElementById('copy-image-button');
    const copyStatus = document.getElementById('copy-status');
    
    copyButton.addEventListener('click', function() {
      copyImageToClipboard(emoji.metadata.url);
    });
    
    // 画像をクリップボードにコピーする関数
    function copyImageToClipboard(url) {
      // 画像を取得して処理する
      fetch(url)
        .then(response => response.blob())
        .then(blob => {
          try {
            // ClipboardItem APIを使用（モダンブラウザのみ対応）
            const item = new ClipboardItem({ 'image/png': blob });
            navigator.clipboard.write([item])
              .then(() => {
                // コピー成功
                copyStatus.style.display = 'block';
                copyStatus.textContent = 'コピーしました！';
                copyStatus.style.color = '#2ecc71';
                
                // 3秒後にステータスを非表示
                setTimeout(() => {
                  copyStatus.style.display = 'none';
                }, 3000);
              })
              .catch(err => {
                // コピー失敗
                copyStatus.style.display = 'block';
                copyStatus.textContent = 'コピーに失敗しました: ' + err.message;
                copyStatus.style.color = '#e74c3c';
              });
          } catch (err) {
            // ClipboardItem APIがサポートされていない場合
            copyStatus.style.display = 'block';
            copyStatus.textContent = 'お使いのブラウザは画像のコピーをサポートしていません';
            copyStatus.style.color = '#e74c3c';
          }
        })
        .catch(err => {
          copyStatus.style.display = 'block';
          copyStatus.textContent = '画像の取得に失敗しました: ' + err.message;
          copyStatus.style.color = '#e74c3c';
        });
    }
    
    // モーダルを表示
    modal.style.display = 'block';
    
    // スクロール防止
    document.body.style.overflow = 'hidden';
  }

  /**
   * モーダルを閉じる
   */
  function closeModal() {
    modal.style.display = 'none';
    
    // スクロール再開
    document.body.style.overflow = '';
  }

  /**
   * エラーメッセージを表示する
   * @param {string} message - エラーメッセージ
   */
  function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'block';
  }

  /**
   * UI状態をリセットする
   */
  function resetUI() {
    errorMessage.style.display = 'none';
    resultsContainer.style.display = 'none';
    noResults.style.display = 'none';
  }

  /**
   * CSRFトークンをクッキーから取得する
   * @param {string} name - クッキー名
   * @returns {string} - トークン
   */
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
});