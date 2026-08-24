import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
APP_URL = os.getenv("APP_URL", "http://localhost:5173")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER)


def send_reset_email(to_email: str, user_name: str, token: str) -> None:
    """Envía el correo de recuperación de contraseña."""
    reset_url = f"{APP_URL}/reset-password?token={token}"

    if not SMTP_USER or not SMTP_PASSWORD:
        # En desarrollo sin SMTP configurado, solo imprime el link
        print(f"[EMAIL] Reset link for {to_email}: {reset_url}")
        return

    subject = "Recupera tu contraseña — rutina"

    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
      <h2 style="margin:0 0 8px;font-size:20px">Recupera tu contraseña</h2>
      <p style="margin:0 0 24px;color:#555">Hola {user_name}, recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>rutina</strong>.</p>
      <a href="{reset_url}"
         style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">
        Restablecer contraseña
      </a>
      <p style="margin:24px 0 0;font-size:12px;color:#999">
        Este enlace es válido por <strong>1 hora</strong> y solo puede usarse una vez.<br>
        Si no solicitaste este cambio, puedes ignorar este correo.
      </p>
    </div>
    """

    text_body = (
        f"Hola {user_name},\n\n"
        f"Para restablecer tu contraseña entra a este enlace (válido por 1 hora):\n"
        f"{reset_url}\n\n"
        f"Si no solicitaste este cambio, ignora este correo."
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = FROM_EMAIL
    msg["To"] = to_email
    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.set_debuglevel(1)  # imprime diálogo SMTP en consola
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        logger.info("Reset email sent to %s", to_email)
    except smtplib.SMTPAuthenticationError as e:
        logger.error("SMTP auth failed: %s", e)
        raise
    except Exception as e:
        logger.error("Failed to send reset email to %s: %s", to_email, e)
        raise
