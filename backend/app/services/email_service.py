import os
import smtplib
import logging
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOGS_DIR = os.path.join(BACKEND_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)
EMAIL_LOG_FILE = os.path.join(LOGS_DIR, "emails.log")


class EmailService:
    """Handles transactional emails for VentureX, supporting SMTP and development logging."""

    @classmethod
    def _is_smtp_configured(cls) -> bool:
        host = os.getenv("SMTP_HOST")
        user = os.getenv("SMTP_USER")
        return bool(host and user)

    @classmethod
    def _send_email_raw(
        cls,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Dispatches an email via SMTP or writes to audit log in development."""
        from_email = os.getenv("SMTP_FROM", "notifications@venturex.io")
        now = datetime.now(timezone.utc).isoformat()

        record = {
            "to": to_email,
            "from": from_email,
            "subject": subject,
            "dispatched_at": now,
            "mode": "smtp" if cls._is_smtp_configured() else "simulated_log",
        }

        if cls._is_smtp_configured():
            try:
                host = os.getenv("SMTP_HOST", "localhost")
                port = int(os.getenv("SMTP_PORT", 587))
                user = os.getenv("SMTP_USER", "")
                password = os.getenv("SMTP_PASSWORD", "")

                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = from_email
                msg["To"] = to_email

                part1 = MIMEText(text_content or subject, "plain")
                part2 = MIMEText(html_content, "html")
                msg.attach(part1)
                msg.attach(part2)

                with smtplib.SMTP(host, port, timeout=10) as server:
                    server.starttls()
                    if user and password:
                        server.login(user, password)
                    server.sendmail(from_email, [to_email], msg.as_string())

                logger.info("Successfully sent SMTP email to %s: '%s'", to_email, subject)
                record["status"] = "sent"
                return record
            except Exception as e:
                logger.warning("SMTP dispatch failed (%s). Falling back to audit log: %s", to_email, e)

        # Log simulated email for local development
        try:
            with open(EMAIL_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(
                    f"\n[{now}] TO: {to_email} | SUBJECT: {subject}\n"
                    f"PREVIEW: {(text_content or subject)[:120]}...\n"
                    f"{'-'*60}\n"
                )
        except Exception as e:
            logger.warning("Could not write to email log file: %s", e)

        logger.info("[EMAIL DISPATCHED] To: %s | Subject: '%s'", to_email, subject)
        record["status"] = "simulated_success"
        return record

    @classmethod
    def send_intro_request_email(
        cls,
        founder_email: str,
        founder_name: str,
        investor_name: str,
        investor_firm: str,
        project_title: str,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Alert founder when an institutional investor expresses interest."""
        subject = f"VentureX Introduction Request: {investor_name} ({investor_firm}) for {project_title}"
        body_text = (
            f"Hi {founder_name},\n\n"
            f"{investor_name} from {investor_firm} has reviewed your syndicate teaser for '{project_title}' "
            f"and requested an introduction to enter your confidential deal room.\n\n"
            f"Investor Note: \"{message or 'Interested in reviewing confidential materials.'}\"\n\n"
            f"Log in to your founder workspace to accept or decline: http://localhost:3000/founder/dashboard?tab=intros\n"
        )
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
          <div style="background: #0F1E36; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #FFFFFF; margin: 0; font-size: 18px;">Venture<span style="color: #38BDF8;">X</span> Syndicate Alert</h2>
          </div>
          <h3 style="color: #0F172A; margin-top: 0;">New Inbound Introduction Request</h3>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            <strong>{investor_name}</strong> from <strong>{investor_firm}</strong> has expressed interest in <strong>{project_title}</strong>.
          </p>
          <div style="background: #F8FAFC; border-left: 4px solid #1B3B6F; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; color: #334155; font-size: 13px; font-style: italic;">"{message or 'Interested in confidential materials and discussing seed fit.'}"</p>
          </div>
          <p style="color: #475569; font-size: 13px;">
            Your AI diagnostic scores and confidential weaknesses remain private. Approving this request unlocks your Deal Room and verified data room.
          </p>
          <div style="margin-top: 24px;">
            <a href="http://localhost:3000/founder/dashboard?tab=intros" style="display: inline-block; background: #1B3B6F; color: #FFFFFF; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">Review & Approve Introduction</a>
          </div>
        </div>
        """
        return cls._send_email_raw(founder_email, subject, html, body_text)

    @classmethod
    def send_dealroom_unlocked_email(
        cls,
        investor_email: str,
        investor_name: str,
        founder_name: str,
        project_title: str,
        room_id: str = "room-neuropulse-blueshift",
    ) -> Dict[str, Any]:
        """Notify investor that founder approved deal room access."""
        subject = f"Deal Room Unlocked: {project_title} with {founder_name}"
        dealroom_url = f"http://localhost:3000/dealroom/{room_id}?role=INVESTOR"
        body_text = (
            f"Hi {investor_name},\n\n"
            f"{founder_name} has accepted your introduction request for '{project_title}'.\n"
            f"Your confidential Deal Room, cap table verification, and direct partner channel are now unlocked:\n"
            f"{dealroom_url}\n"
        )
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
          <div style="background: #0F1E36; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #FFFFFF; margin: 0; font-size: 18px;">Venture<span style="color: #38BDF8;">X</span> Diligence Room</h2>
          </div>
          <div style="background: #E8F5E9; border: 1px solid #C8E6C9; color: #1E5236; padding: 10px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; margin-bottom: 16px;">
            ✓ Introduction Accepted by Founding Team
          </div>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            <strong>{founder_name}</strong> has granted you access to the confidential diligence room for <strong>{project_title}</strong>.
          </p>
          <ul style="color: #475569; font-size: 13px; line-height: 1.8;">
            <li>Direct encrypted founder messaging channel</li>
            <li>Verified cap table and financial models</li>
            <li>Mutual NDA digital countersigning</li>
          </ul>
          <div style="margin-top: 24px;">
            <a href="{dealroom_url}" style="display: inline-block; background: #2E7D52; color: #FFFFFF; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">Enter Secure Deal Room</a>
          </div>
        </div>
        """
        return cls._send_email_raw(investor_email, subject, html, body_text)

    @classmethod
    def send_dealroom_message_alert(
        cls,
        recipient_email: str,
        recipient_name: str,
        sender_name: str,
        project_title: str,
        message_preview: str,
        room_id: str,
        recipient_role: str = "INVESTOR",
    ) -> Dict[str, Any]:
        """Alert participant of a new cryptographic message in the Deal Room."""
        subject = f"New Deal Room Message: {sender_name} ({project_title})"
        dealroom_url = f"http://localhost:3000/dealroom/{room_id}?role={recipient_role}"
        body_text = (
            f"Hi {recipient_name},\n\n"
            f"{sender_name} posted a new message in the '{project_title}' Deal Room:\n\n"
            f"\"{message_preview[:200]}\"\n\n"
            f"View conversation: {dealroom_url}\n"
        )
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
          <h3 style="color: #0F172A; margin-top: 0;">New Deal Room Message</h3>
          <p style="color: #475569; font-size: 14px;"><strong>{sender_name}</strong> sent a message regarding <strong>{project_title}</strong>:</p>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; color: #334155; font-size: 13px;">"{message_preview[:280]}..."</p>
          </div>
          <div style="margin-top: 20px;">
            <a href="{dealroom_url}" style="display: inline-block; background: #1B3B6F; color: #FFFFFF; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">Open Deal Room</a>
          </div>
        </div>
        """
        return cls._send_email_raw(recipient_email, subject, html, body_text)
