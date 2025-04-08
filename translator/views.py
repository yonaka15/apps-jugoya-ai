from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import permission_required
import requests
import os
import dotenv
import logging

dotenv.load_dotenv()


@permission_required("translator.view_app")
def index(request):
    """
    メインページを表示する。認証済みユーザーのみアクセス可能。
    """
    return render(request, "translator/index.html", {})


@permission_required("translator.view_app")
def session(request):
    """
    OpenAI Realtime API のセッショントークンを取得する。
    リクエストパラメータ:
        voice: 音声モデル名（デフォルト: verse）
    """
    API_KEY = os.environ.get("OPENAI_API_KEY")
    voice = request.GET.get("voice", "verse")
    model = request.GET.get("model", "gpt-4o-realtime-preview-2024-12-17")

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
                "voice": voice,  # alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse
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
