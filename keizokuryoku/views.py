from django.shortcuts import render
from django.contrib.auth.decorators import permission_required
import requests
import dotenv
import os
import json
import re
from django.http import JsonResponse, HttpResponseServerError

dotenv.load_dotenv()


def index(request):
    """
    メインページを表示する
    """
    return render(request, "keizokuryoku/index.html")


def query(request):
    """
    事業継続力強化計画ドキュメント検索APIにクエリを送信し、結果をJSONで返す
    GETメソッドに対応

    :param request: HTTPリクエスト
    :return: JSON形式のレスポンス
    """
    # GETメソッドからクエリを取得
    if request.method == "GET":
        search_query = request.GET.get("query", "").strip()
    else:
        return JsonResponse(
            {"error": "不正なリクエスト方法です。GETリクエストを使用してください。"},
            status=400,
        )

    if not search_query:
        return JsonResponse({"error": "検索キーワードを入力してください。"}, status=400)

    response_data = {
        "query": search_query,
        "pages": [],
        "error": None,
    }

    try:
        api_url = f"{os.getenv('API_HOST')}{os.getenv('KEIZOKURYOKU_ENDPOINT')}"
        headers = {
            "Content-Type": "application/json",
            "api-key": os.getenv("API_KEY"),
        }
        payload = {
            "query": search_query,
        }

        # APIリクエストの実行
        response = requests.post(api_url, json=payload, headers=headers)

        # レスポンスのステータスコードを確認
        if response.status_code != 200:
            response_data["error"] = (
                f"APIエラー: ステータスコード {response.status_code}"
            )
            return JsonResponse(response_data, status=500)

        # JSONレスポンスをパース
        try:
            data = response.json()

            # 各ページにページ番号情報を追加
            processed_pages = []
            for page in data:
                # filenameからページ番号を抽出する
                filename = page.get('metadata', {}).get('filename', '')
                page_number_match = re.search(r'Page_(\d+)', filename)
                page_number = int(page_number_match.group(1)) if page_number_match else 0
                
                # メタデータにページ番号情報を追加
                if 'metadata' not in page:
                    page['metadata'] = {}
                page['metadata']['page_number'] = page_number
                page['metadata']['document_title'] = "事業継続力強化計画"
                
                processed_pages.append(page)
            
            # 類似度の高い順にソート（降順）
            processed_pages.sort(key=lambda x: x['similarity'], reverse=True)
            
            response_data["pages"] = processed_pages
        except json.JSONDecodeError:
            response_data["error"] = "APIからの応答を解析できませんでした。"
            return JsonResponse(response_data, status=500)

    except requests.RequestException as e:
        response_data["error"] = f"API接続エラー: {str(e)}"
        return JsonResponse(response_data, status=500)
    except Exception as e:
        response_data["error"] = f"予期しないエラーが発生しました: {str(e)}"
        return JsonResponse(response_data, status=500)

    return JsonResponse(response_data)
