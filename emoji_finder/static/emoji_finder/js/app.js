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
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
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
      searchButton.classList.add('bg-blue-300', 'cursor-not-allowed');
      searchButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
      searchInput.disabled = true;
      
      // ローディングインジケータを表示
      loadingIndicator.classList.remove('hidden');
    } else {
      // 検索ボタンをアクティブに戻す
      searchButton.disabled = false;
      searchButton.classList.remove('bg-blue-300', 'cursor-not-allowed');
      searchButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
      searchInput.disabled = false;
      
      // ローディングインジケータを非表示
      loadingIndicator.classList.add('hidden');
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
    resultsContainer.classList.remove('hidden');
    
    // 検索クエリを表示
    resultsHeading.textContent = `検索結果: "${data.query}"`;
    
    // 絵文字が見つからない場合
    if (!data.emojis || data.emojis.length === 0) {
      noResults.classList.remove('hidden');
      return;
    }
    
    // 結果の件数を表示
    resultsCount.innerHTML = `<p>${data.emojis.length}件の結果が見つかりました</p>`;
    
    // 絵文字結果をクリア
    emojiResults.innerHTML = '';
    
    // 各絵文字のカードを作成
    data.emojis.forEach((emoji, index) => {
      const emojiCard = document.createElement('div');
      emojiCard.className = 'bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow transform hover:-translate-y-1 cursor-pointer';
      emojiCard.dataset.index = index; // インデックスを記録
      
      // Unicode値からファイル名を抽出
      const codePoint = emoji.metadata.filename.replace(/\.[^/.]+$/, ""); // 拡張子を削除
      const nameFromCode = codePoint.replace('U+', '');
      
      // 実際のHTML作成
      emojiCard.innerHTML = `
        <div class="h-36 flex items-center justify-center mb-4">
          <img src="${emoji.metadata.url}" alt="${nameFromCode}" class="max-w-full max-h-full object-contain">
        </div>
        <div class="text-center">
          <h3 class="text-lg font-semibold text-blue-600 mb-1">${nameFromCode}</h3>
          <p class="text-sm text-gray-600">類似度: ${(emoji.similarity * 100).toFixed(1)}%</p>
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
      <h3 class="text-xl font-bold text-gray-800 mb-4">絵文字コード: ${nameFromCode}</h3>
      <div class="space-y-2 mb-6">
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>類似度: ${(emoji.similarity * 100).toFixed(1)}%</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>形式: ${emoji.metadata.original_format}</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>タイムスタンプ: ${timestamp}</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>モデル: ${emoji.metadata.model}</p>
      </div>
      <button id="copy-image-button" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors">画像をコピー</button>
      <p id="copy-status" class="mt-2 text-sm font-medium hidden"></p>
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
                copyStatus.classList.remove('hidden', 'text-red-500');
                copyStatus.classList.add('text-green-500');
                copyStatus.textContent = 'コピーしました！';
                
                // 3秒後にステータスを非表示
                setTimeout(() => {
                  copyStatus.classList.add('hidden');
                }, 3000);
              })
              .catch(err => {
                // コピー失敗
                copyStatus.classList.remove('hidden', 'text-green-500');
                copyStatus.classList.add('text-red-500');
                copyStatus.textContent = 'コピーに失敗しました: ' + err.message;
              });
          } catch (err) {
            // ClipboardItem APIがサポートされていない場合
            copyStatus.classList.remove('hidden', 'text-green-500');
            copyStatus.classList.add('text-red-500');
            copyStatus.textContent = 'お使いのブラウザは画像のコピーをサポートしていません';
          }
        })
        .catch(err => {
          copyStatus.classList.remove('hidden', 'text-green-500');
          copyStatus.classList.add('text-red-500');
          copyStatus.textContent = '画像の取得に失敗しました: ' + err.message;
        });
    }
    
    // モーダルを表示
    modal.classList.remove('hidden');
    
    // スクロール防止
    document.body.classList.add('overflow-hidden');
  }

  /**
   * モーダルを閉じる
   */
  function closeModal() {
    modal.classList.add('hidden');
    
    // スクロール再開
    document.body.classList.remove('overflow-hidden');
  }

  /**
   * エラーメッセージを表示する
   * @param {string} message - エラーメッセージ
   */
  function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  /**
   * UI状態をリセットする
   */
  function resetUI() {
    errorMessage.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    noResults.classList.add('hidden');
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