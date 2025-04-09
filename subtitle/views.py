from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import permission_required
import requests
import os
import json
import dotenv
import logging

# 環境変数を読み込む
dotenv.load_dotenv()


@permission_required("subtitle.view_app")
def index(request):
    """
    字幕設定ページを表示する。
    """
    return render(request, "subtitle/index.html")


@permission_required("subtitle.view_app", raise_exception=True)
def viewer(request):
    """
    字幕表示ページを表示する。
    """
    return render(request, "subtitle/viewer.html")


# 権限チェックを復活
@permission_required("subtitle.view_app", raise_exception=True)
@csrf_exempt  # POSTリクエストの場合はCSRF検証が必要なため、例外的に免除
def session(request):
    """
    OpenAI Realtime API のセッショントークンを取得する。
    POSTリクエスト:
        model: 使用するモデル (デフォルト: gpt-4o-realtime-preview-2024-12-17)
        instructions: AIへの指示文 (デフォルト: "Please respond in Japanese.")
    """
    API_KEY = os.environ.get("OPENAI_API_KEY")

    # POSTかGETかで処理を分ける
    if request.method == "POST":
        try:
            # JSONデータをリクエストボディから取得
            data = json.loads(request.body)
            model = data.get("model", "gpt-4o-realtime-preview-2024-12-17")
            instructions = data.get("instructions", "Please respond in Japanese.")
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
    else:
        # 後方互換性のためGETも許可
        model = request.GET.get("model", "gpt-4o-realtime-preview-2024-12-17")
        instructions = request.GET.get("instructions", "Please respond in Japanese.")

    if not API_KEY:
        logging.error("OpenAI API key not found in environment variables")
        return JsonResponse({"error": "API key not found"}, status=500)

    try:
        response = requests.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "voice": "verse",  # 音声出力しないため固定値を使用
                "instructions": instructions,
                "modalities": ["text"],
            },
        )

        if response.status_code != 200:
            logging.error(
                f"Failed to create session: {response.status_code} - {response.text}"
            )
            return JsonResponse(
                {"error": "Failed to create session"}, status=response.status_code
            )

        data = response.json()
        client_secret = data.get("client_secret")

        if not client_secret:
            logging.error("No client_secret in response", extra={"response": data})
            return JsonResponse({"error": "Failed to create session"}, status=500)

        value = client_secret.get("value")
        if not value:
            logging.error(
                "No value in client_secret", extra={"client_secret": client_secret}
            )
            return JsonResponse({"error": "Failed to create session"}, status=500)

        return JsonResponse({"client_secret": {"value": value}})

    except Exception as e:
        logging.exception("Error creating session")
        return JsonResponse({"error": str(e)}, status=500)
