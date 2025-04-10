/**
 * 事業継続力強化計画検索アプリケーションのJavaScript
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
  const pageResults = document.getElementById('page-results');
  const noResults = document.getElementById('no-results');

  // モーダル要素
  const modal = document.getElementById('page-modal');
  const modalImage = document.getElementById('modal-image');
  const modalDetails = document.getElementById('modal-details');
  const closeButton = document.querySelector('.close-button');

  // 検索結果を保存する変数
  let currentSearchResults = [];
  let currentQuery = '';
  let currentPageIndex = 0;

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
    fetch(`/keizokuryoku/query/?query=${encodeURIComponent(query)}`, {
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
      currentSearchResults = data.pages || [];
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
    
    // ページが見つからない場合
    if (!data.pages || data.pages.length === 0) {
      noResults.classList.remove('hidden');
      return;
    }
    
    // 結果の件数を表示
    resultsCount.innerHTML = `<p>${data.pages.length}件の結果が見つかりました</p>`;
    
    // ページ結果をクリア
    pageResults.innerHTML = '';
    
    // 各ページのカードを作成
    data.pages.forEach((page, index) => {
      const pageCard = document.createElement('div');
      pageCard.className = 'bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow transform hover:-translate-y-1 cursor-pointer';
      pageCard.dataset.index = index; // インデックスを記録
      
      // 実際のHTML作成
      pageCard.innerHTML = `
        <div class="h-36 flex items-center justify-center mb-4">
          <img src="${page.metadata.url}" alt="ページ ${page.metadata.page_number}" class="max-w-full max-h-full object-contain">
        </div>
        <div class="text-center">
          <h3 class="text-lg font-semibold text-blue-600 mb-1">ページ ${page.metadata.page_number}</h3>
          <p class="text-sm text-gray-600">類似度: ${(page.similarity * 100).toFixed(1)}%</p>
        </div>
      `;
      
      // クリックイベントでモーダルを開く
      pageCard.addEventListener('click', function() {
        openPageModal(index);
      });
      
      pageResults.appendChild(pageCard);
    });
  }

  /**
   * ページモーダルを開く
   * @param {number} index - ページのインデックス
   */
  function openPageModal(index) {
    currentPageIndex = index;
    const page = currentSearchResults[index];
    if (!page) return;
    
    // モーダル画像を設定
    modalImage.src = page.metadata.url;
    modalImage.alt = `ページ ${page.metadata.page_number}`;
    
    // 日時をフォーマット
    const timestamp = new Date(page.metadata.timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // モーダル詳細情報を設定
    modalDetails.innerHTML = `
      <h3 class="text-xl font-bold text-gray-800 mb-4">ページ ${page.metadata.page_number}</h3>
      <div class="space-y-2 mb-6">
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>類似度: ${(page.similarity * 100).toFixed(1)}%</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>ドキュメント: ${page.metadata.document_title || "事業継続力強化計画"}</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>タイムスタンプ: ${timestamp}</p>
      </div>
      <div class="flex justify-between mt-4">
        <button id="prev-page-button" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded transition-colors ${index === 0 ? 'opacity-50' : ''}" ${index === 0 ? 'disabled' : ''}>
          前のページ
        </button>
        <button id="next-page-button" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded transition-colors ${index === currentSearchResults.length - 1 ? 'opacity-50' : ''}" ${index === currentSearchResults.length - 1 ? 'disabled' : ''}>
          次のページ
        </button>
      </div>
    `;
    
    // ボタンのイベントリスナーを設定
    const prevButton = document.getElementById('prev-page-button');
    const nextButton = document.getElementById('next-page-button');
    
    if (prevButton) {
      prevButton.addEventListener('click', function() {
        if (currentPageIndex > 0) {
          currentPageIndex--;
          openPageModal(currentPageIndex);
        }
      });
    }
    
    if (nextButton) {
      nextButton.addEventListener('click', function() {
        if (currentPageIndex < currentSearchResults.length - 1) {
          currentPageIndex++;
          openPageModal(currentPageIndex);
        }
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