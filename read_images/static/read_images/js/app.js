/**
 * 画像検索アプリケーションの JavaScript
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
  const imageResults = document.getElementById('image-results');
  const noResults = document.getElementById('no-results');

  // モーダル要素
  const modal = document.getElementById('image-modal');
  const modalImage = document.getElementById('modal-image');
  const modalDetails = document.getElementById('modal-details');
  const closeButton = document.querySelector('.close-button');

  // 検索結果を保存する変数
  let currentSearchResults = [];

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
    fetch(`/read_images/query/?query=${encodeURIComponent(query)}`, {
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
      currentSearchResults = data.images || [];
      
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
    
    // 画像が見つからない場合
    if (!data.images || data.images.length === 0) {
      noResults.style.display = 'block';
      return;
    }
    
    // 結果の件数を表示
    resultsCount.innerHTML = `<p>${data.images.length}件の結果が見つかりました</p>`;
    
    // 画像結果をクリア
    imageResults.innerHTML = '';
    
    // 各画像のカードを作成
    data.images.forEach((image, index) => {
      const imageCard = document.createElement('div');
      imageCard.className = 'image-card';
      imageCard.dataset.index = index; // インデックスを記録
      
      const similarity = image.similarity.toFixed(2);
      const timestamp = formatTimestamp(image.metadata.timestamp);
      
      imageCard.innerHTML = `
        <div class="image-container">
          <img src="${image.metadata.url}" alt="${image.metadata.filename}">
        </div>
        <div class="image-details">
          <h3>${image.metadata.filename}</h3>
          <p class="similarity">類似度: ${similarity}</p>
          <p class="timestamp">撮影日時: ${timestamp}</p>
          <p class="model">処理モデル: ${image.metadata.model}</p>
        </div>
      `;
      
      // クリックイベントでモーダルを開く
      imageCard.addEventListener('click', function() {
        openImageModal(index);
      });
      
      imageResults.appendChild(imageCard);
    });
  }

  /**
   * 画像モーダルを開く
   * @param {number} index - 画像のインデックス
   */
  function openImageModal(index) {
    const image = currentSearchResults[index];
    if (!image) return;
    
    // モーダル画像を設定
    modalImage.src = image.metadata.url;
    modalImage.alt = image.metadata.filename;
    
    // モーダル詳細情報を設定
    const similarity = image.similarity.toFixed(2);
    const timestamp = formatTimestamp(image.metadata.timestamp);
    
    modalDetails.innerHTML = `
      <h3>${image.metadata.filename}</h3>
      <p class="similarity">類似度: ${similarity}</p>
      <p class="timestamp">撮影日時: ${timestamp}</p>
      <p class="model">処理モデル: ${image.metadata.model}</p>
      <p class="format">ファイル形式: ${image.metadata.original_format}</p>
      <p class="usage">使用トークン: ${image.metadata.usage?.total_tokens || 'N/A'}</p>
    `;
    
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
   * タイムスタンプを整形する
   * @param {string} timestamp - ISO形式のタイムスタンプ
   * @returns {string} - 整形された日時
   */
  function formatTimestamp(timestamp) {
    if (!timestamp) return '不明';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return timestamp; // パースに失敗した場合は元の文字列を返す
    }
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