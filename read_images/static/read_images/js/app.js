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

  // AIの回答関連の要素
  const aiAnswerSection = document.getElementById('ai-answer-section');
  const getAnswerButton = document.getElementById('get-answer-button');
  const answerLoadingIndicator = document.getElementById('answer-loading-indicator');
  const answerContainer = document.getElementById('answer-container');
  const answerContent = document.getElementById('answer-content');

  // モーダル要素
  const modal = document.getElementById('image-modal');
  const modalImage = document.getElementById('modal-image');
  const modalDetails = document.getElementById('modal-details');
  const closeButton = document.querySelector('.close-button');

  // 検索結果を保存する変数
  let currentSearchResults = [];
  let currentQuery = '';

  // 検索ボタンのイベントリスナー
  searchButton.addEventListener('click', performSearch);

  // AIの回答ボタンのイベントリスナー
  getAnswerButton.addEventListener('click', getAIAnswer);

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
      currentQuery = data.query || query;
      
      // 検索結果を表示
      displayResults(data);
      
      // 画像が見つかった場合は、AIの回答セクションを表示
      if (currentSearchResults.length > 0) {
        aiAnswerSection.classList.remove('hidden');
      }
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
   * AIの回答を取得する
   */
  function getAIAnswer() {
    // 回答が取得できる状態か確認
    if (currentSearchResults.length === 0 || !currentQuery) {
      showError('回答を取得するには、まず検索を行ってください。');
      return;
    }

    // ボタンを非アクティブにし、ローディング表示
    setAnswerLoadingState(true);
    
    // 画像URLの配列を作成
    const imageUrls = currentSearchResults.map(img => img.metadata.url);
    
    // CSRF トークンを取得
    const csrfToken = getCookie('csrftoken');
    
    // FormDataオブジェクトを作成
    const formData = new FormData();
    formData.append('query', currentQuery);
    
    // 複数のURLをFormDataに追加
    imageUrls.forEach(url => {
      formData.append('urls', url);
    });
    
    // 回答取得リクエスト
    fetch('/read_images/answer/', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': csrfToken
      },
      body: formData
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
      // 回答を表示
      displayAnswer(data);
    })
    .catch(error => {
      showError(`回答取得中にエラーが発生しました: ${error.message}`);
      // エラー時はコンテナを非表示に
      answerContainer.classList.add('hidden');
    })
    .finally(() => {
      // ローディング状態を解除
      setAnswerLoadingState(false);
    });
  }

  /**
   * 回答取得中の状態を設定する
   * @param {boolean} isLoading - 取得中かどうか
   */
  function setAnswerLoadingState(isLoading) {
    if (isLoading) {
      // ボタンを非アクティブにする
      getAnswerButton.disabled = true;
      getAnswerButton.classList.add('bg-green-300', 'cursor-not-allowed');
      getAnswerButton.classList.remove('bg-green-500', 'hover:bg-green-600');
      
      // ローディングインジケータを表示
      answerLoadingIndicator.classList.remove('hidden');
      
      // 回答コンテナを非表示
      answerContainer.classList.add('hidden');
    } else {
      // ボタンをアクティブに戻す
      getAnswerButton.disabled = false;
      getAnswerButton.classList.remove('bg-green-300', 'cursor-not-allowed');
      getAnswerButton.classList.add('bg-green-500', 'hover:bg-green-600');
      
      // ローディングインジケータを非表示
      answerLoadingIndicator.classList.add('hidden');
    }
  }

  /**
   * AIの回答を表示する
   * @param {Object} data - APIからのレスポンスデータ
   */
  function displayAnswer(data) {
    // エラーチェック
    if (data.error) {
      showError(data.error);
      return;
    }
    
    // 回答データがない場合
    if (!data.answer) {
      showError('AIからの回答を取得できませんでした。');
      return;
    }
    
    // 回答コンテナを表示
    answerContainer.classList.remove('hidden');
    
    // 回答内容を設定
    let answerText = '';
    
    // APIの応答形式に応じて適切に処理
    if (typeof data.answer === 'string') {
      answerText = data.answer;
    } else if (typeof data.answer === 'object') {
      // Claude API形式のレスポンス処理
      if (data.answer.content && Array.isArray(data.answer.content)) {
        // content配列からtextタイプのコンテンツを抽出
        const textContents = data.answer.content
          .filter(item => item.type === 'text')
          .map(item => item.text);
        
        if (textContents.length > 0) {
          answerText = textContents.join('\n\n');
        }
      } 
      // 従来の応答形式も処理
      else if (data.answer.response) {
        answerText = data.answer.response;
      } else if (data.answer.answer) {
        answerText = data.answer.answer;
      } else {
        // 上記のプロパティがない場合はJSONを文字列化
        answerText = JSON.stringify(data.answer, null, 2);
      }
    }
    
    // HTMLエスケープして表示
    answerContent.textContent = answerText;
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
    
    // 画像が見つからない場合
    if (!data.images || data.images.length === 0) {
      noResults.classList.remove('hidden');
      return;
    }
    
    // 結果の件数を表示
    resultsCount.innerHTML = `<p>${data.images.length}件の結果が見つかりました</p>`;
    
    // 画像結果をクリア
    imageResults.innerHTML = '';
    
    // 各画像のカードを作成
    data.images.forEach((image, index) => {
      const imageCard = document.createElement('div');
      imageCard.className = 'bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow transform hover:-translate-y-1 cursor-pointer';
      imageCard.dataset.index = index; // インデックスを記録
      
      const similarity = image.similarity.toFixed(2);
      const timestamp = formatTimestamp(image.metadata.timestamp);
      
      imageCard.innerHTML = `
        <div class="h-48 overflow-hidden">
          <img src="${image.metadata.url}" alt="${image.metadata.filename}" class="w-full h-full object-cover">
        </div>
        <div class="p-4">
          <h3 class="text-lg font-semibold text-gray-800 mb-2 break-all">${image.metadata.filename}</h3>
          <p class="text-blue-600 font-medium mb-1">類似度: ${similarity}</p>
          <p class="text-gray-600 text-sm mb-1">撮影日時: ${timestamp}</p>
          <p class="text-gray-600 text-sm">処理モデル: ${image.metadata.model}</p>
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
      <h3 class="text-xl font-bold text-gray-800 mb-4">${image.metadata.filename}</h3>
      <div class="space-y-2 mb-4">
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>類似度: ${similarity}</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>撮影日時: ${timestamp}</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>処理モデル: ${image.metadata.model}</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>ファイル形式: ${image.metadata.original_format || 'N/A'}</p>
        <p class="flex items-center text-gray-700"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>使用トークン: ${image.metadata.usage?.total_tokens || 'N/A'}</p>
      </div>
    `;
    
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
    aiAnswerSection.classList.add('hidden');
    answerContainer.classList.add('hidden');
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