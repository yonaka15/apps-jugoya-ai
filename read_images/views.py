from django.shortcuts import render
from django.contrib.auth.decorators import login_required
import requests
import dotenv
import os
import json
from django.http import JsonResponse, HttpResponseServerError

dotenv.load_dotenv()


def index(request):
    """
    メインページを表示する
    """
    return render(request, "read_images/index.html")


@login_required()
def query(request):
    """
    画像検索APIにクエリを送信し、結果をJSONで返す
    GET/POSTどちらのメソッドも対応

    :param request: HTTPリクエスト
    :return: JSON形式のレスポンス
    """
    # GETとPOSTどちらのメソッドにも対応
    if request.method == "GET":
        search_query = request.GET.get("query", "").strip()
    elif request.method == "POST":
        search_query = request.POST.get("query", "").strip()
    else:
        return JsonResponse(
            {
                "error": "不正なリクエスト方法です。GETまたはPOSTリクエストを使用してください。"
            },
            status=400,
        )

    if not search_query:
        return JsonResponse({"error": "検索キーワードを入力してください。"}, status=400)

    response_data = {
        "query": search_query,
        "images": [],
        "error": None,
    }

    try:
        api_url = f"{os.getenv('API_HOST')}{os.getenv('QUERY_ENDPOINT')}"
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
            response_data["images"] = data
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


@login_required()
def answer(request):
    """
    検索クエリと画像URLをもとにAIからの回答を取得する

    :param request: HTTPリクエスト
    :return: JSON形式のレスポンス
    """
    if request.method != "POST":
        return JsonResponse({"error": "POSTリクエストのみ対応しています。"}, status=400)

    # リクエストからデータを取得
    search_query = request.POST.get("query", "").strip()
    image_urls = request.POST.getlist("urls", [])

    if not search_query:
        return JsonResponse({"error": "検索キーワードを入力してください。"}, status=400)

    if not image_urls:
        return JsonResponse({"error": "画像URLが提供されていません。"}, status=400)

    response_data = {
        "query": search_query,
        "answer": None,
        "error": None,
    }

    try:
        api_url = f"{os.getenv('API_HOST')}{os.getenv('ANSWER_ENDPOINT')}"
        headers = {
            "Content-Type": "application/json",
            "api-key": os.getenv("API_KEY"),
        }
        payload = {
            "query": search_query,
            "urls": image_urls,
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
            response_data["answer"] = data
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
