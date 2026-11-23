import os
import smtplib
import logging
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def _app_url() -> str:
    """Base URL for links in emails (PUBLIC_APP_URL), without a trailing slash."""
    from app.core.config import settings
    return (settings.PUBLIC_APP_URL or "http://localhost:3000").rstrip("/")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOGS_DIR = os.path.join(BACKEND_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)
EMAIL_LOG_FILE = os.path.join(LOGS_DIR, "emails.log")


class EmailService:
    """Handles transactional emails for VentureX, supporting SMTP and development logging."""

    @staticmethod
    def _smtp():
        # Read through app settings so values in backend/.env are honoured (os.getenv alone
        # never saw them: nothing loads .env into the process environment).
        from app.core.config import settings
        return settings

    @classmethod
    def _is_smtp_configured(cls) -> bool:
        s = cls._smtp()
        return bool(s.SMTP_HOST and s.SMTP_USER)

    @classmethod
    def _send_email_raw(
        cls,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Dispatches an email via SMTP or writes to audit log in development."""
        from_email = cls._smtp().SMTP_FROM or "notifications@venturex.io"
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
                s = cls._smtp()
                host = s.SMTP_HOST or "localhost"
                port = int(s.SMTP_PORT or 587)
                user = s.SMTP_USER or ""
                password = s.SMTP_PASSWORD or ""

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
    def send_strong_match_email(
        cls,
        founder_email: str,
        founder_name: str,
        investor_label: str,
        project_title: str,
        score: float,
    ) -> Dict[str, Any]:
        """Tell a founder that an investor's criteria closely fit one of their published projects."""
        link = f"{_app_url()}/founder/dashboard?tab=investors"
        subject = f"Strong investor fit for {project_title}: {investor_label} ({round(score)}%)"
        body_text = (
            f"Hi {founder_name},\n\n"
            f"{investor_label}'s investment criteria closely fit {project_title} ({round(score)}% fit).\n\n"
            f"See why they match: {link}\n\n"
            "You're getting this because 'Email me about strong matches' is on in your VentureX settings.\n"
        )
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E7E0D3; border-radius: 12px; background: #FFFDF9;">
          <h2 style="color: #111C32; margin: 0 0 12px; font-family: Georgia, serif; font-weight: 500;">A strong investor fit</h2>
          <p style="color: #33405A; font-size: 14px; line-height: 1.6;">
            <strong>{investor_label}</strong>'s criteria closely fit <strong>{project_title}</strong> ({round(score)}% fit).
          </p>
          <a href="{link}" style="display: inline-block; margin-top: 12px; background: #20477F; color: #FFFFFF; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">See why they match</a>
          <p style="color: #6B6457; font-size: 12px; margin-top: 20px;">You can turn these emails off in Settings.</p>
        </div>
        """
        return cls._send_email_raw(founder_email, subject, html, body_text)

    @classmethod
    def send_verification_code_email(cls, to_email: str, project_title: str, code: str, minutes: int) -> Dict[str, Any]:
        """The code that proves the founder can receive email on the startup's domain."""
        subject = f"Your VentureX verification code: {code}"
        body_text = (
            f"Your code to verify {project_title} on VentureX is {code}.\n\n"
            f"It expires in {minutes} minutes. If you didn't ask for it, ignore this email.\n"
        )
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E7E0D3; border-radius: 12px; background: #FFFDF9;">
          <h2 style="color: #111C32; margin: 0 0 12px; font-family: Georgia, serif; font-weight: 500;">Verify {project_title}</h2>
          <p style="color: #33405A; font-size: 14px;">Enter this code in VentureX to verify your company:</p>
          <p style="font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #20477F; margin: 12px 0;">{code}</p>
          <p style="color: #6B6457; font-size: 12px;">It expires in {minutes} minutes. If you didn't ask for it, ignore this email.</p>
        </div>
        """
        return cls._send_email_raw(to_email, subject, html, body_text)

    @classmethod
    def send_founder_intro_request_email(
        cls,
        investor_email: str,
        investor_name: str,
        founder_name: str,
        project_title: str,
        summary: str,
        note: str,
    ) -> Dict[str, Any]:
        """Tell an investor that a founder asked to connect about a published startup."""
        link = f"{_app_url()}/investor/deal-flow"
        subject = f"{founder_name} would like to connect about {project_title}"
        body_text = (
            f"Hi {investor_name},\n\n{founder_name} asked to connect about {project_title} on VentureX.\n\n"
            f"{summary}\n\nTheir note: \"{note}\"\n\nReply Interested or Pass in your Deal Flow: {link}\n"
        )
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E7E0D3; border-radius: 12px; background: #FFFDF9;">
          <h2 style="color: #111C32; margin: 0 0 12px; font-family: Georgia, serif; font-weight: 500;">A founder would like to connect</h2>
          <p style="color: #33405A; font-size: 14px; line-height: 1.6;"><strong>{founder_name}</strong> asked to connect about <strong>{project_title}</strong>.</p>
          <p style="color: #6B6457; font-size: 13px; line-height: 1.6;">{summary}</p>
          <p style="color: #33405A; font-size: 13px; font-style: italic; border-left: 3px solid #20477F; padding-left: 12px;">"{note}"</p>
          <a href="{link}" style="display: inline-block; margin-top: 12px; background: #20477F; color: #FFFFFF; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">Reply in Deal Flow</a>
        </div>
        """
        return cls._send_email_raw(investor_email, subject, html, body_text)

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
            f"Log in to your founder workspace to accept or decline: {_app_url()}/founder/dashboard?tab=intros\n"
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
            <a href="{_app_url()}/founder/dashboard?tab=intros" style="display: inline-block; background: #1B3B6F; color: #FFFFFF; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">Review & Approve Introduction</a>
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
        dealroom_url = f"{_app_url()}/dealroom/{room_id}?role=INVESTOR"
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
        dealroom_url = f"{_app_url()}/dealroom/{room_id}?role={recipient_role}"
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
