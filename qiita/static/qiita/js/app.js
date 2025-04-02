/**
 * Qiita記事検索アプリケーションの JavaScript
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
  const articleResults = document.getElementById('article-results');
  const noResults = document.getElementById('no-results');

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
    fetch(`/qiita/query/?query=${encodeURIComponent(query)}`, {
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
      currentSearchResults = data.articles || [];
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
    
    // 記事が見つからない場合
    if (!data.articles || data.articles.length === 0) {
      noResults.classList.remove('hidden');
      return;
    }
    
    // 結果の件数を表示
    resultsCount.innerHTML = `<p>${data.articles.length}件の記事が見つかりました</p>`;
    
    // 記事結果をクリア
    articleResults.innerHTML = '';
    
    // 各記事のカードを作成
    data.articles.forEach((article, index) => {
      const metadata = article.metadata;
      
      // 記事カードを作成
      const articleCard = document.createElement('a');
      articleCard.href = metadata.url;
      articleCard.target = "_blank";  // 新規タブで開く
      articleCard.className = 'block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow mb-4';
      
      // タイムスタンプをフォーマット
      const createdAt = formatTimestamp(metadata.created_at);
      
      // タグをフォーマット（タグはオブジェクトの配列）
      const tagsText = metadata.tags.map(tag => tag.name).join(', ');
      
      // 相似度をパーセントに変換
      const similarityPercent = (article.similarity * 100).toFixed(1);
      
      articleCard.innerHTML = `
        <div class="p-5">
          <h3 class="text-lg font-semibold text-blue-600 mb-2">${metadata.title}</h3>
          <div class="flex flex-wrap items-center text-sm text-gray-500 mb-3">
            <span class="mr-3 mb-1">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              ${createdAt}
            </span>
            <span class="mr-3 mb-1">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
              </svg>
              ${tagsText}
            </span>
          </div>
          <div class="flex flex-wrap items-center">
            <span class="text-sm text-gray-500 mr-3 mb-1">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
              </svg>
              ${metadata.likes_count} いいね
            </span>
            <span class="text-sm text-gray-500 mr-3 mb-1">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
              ${metadata.page_views_count} 閲覧
            </span>
            <span class="text-sm text-blue-500 mb-1">
              <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              関連度: ${similarityPercent}%
            </span>
          </div>
        </div>
      `;
      
      articleResults.appendChild(articleCard);
    });
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