import argparse
import getpass
import sys
from sqlalchemy import select
from app.config import get_settings
from app.core.security import hash_password
from app.db.session import get_session_factory
from app.models.user import User


def provision_admin(email: str, full_name: str, password: str) -> User:
    """
    Secure server-side provisioning function for creating or promoting an administrator account.
    Never exposed through public HTTP signup endpoints.
    """
    clean_email = email.strip().lower()
    session_factory = get_session_factory()

    with session_factory() as db:
        user = db.scalar(select(User).where(User.email == clean_email))

        if user:
            # Upgrade existing account to admin
            user.role = "admin"
            user.full_name = full_name.strip() or user.full_name
            if password:
                user.hashed_password = hash_password(password)
            user.is_active = True
            db.commit()
            db.refresh(user)
            print(f"[SUCCESS] Upgraded existing account '{clean_email}' (ID: {user.id}) to role 'admin'.")
            return user
        else:
            # Create fresh admin user
            new_user = User(
                email=clean_email,
                hashed_password=hash_password(password),
                full_name=full_name.strip() or "System Admin",
                role="admin",
                is_active=True,
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            print(f"[SUCCESS] Successfully provisioned new administrator '{clean_email}' (ID: {new_user.id}).")
            return new_user


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(
        description="Securely provision or upgrade a CareerCompass AI administrator account."
    )
    parser.add_argument("--email", default=settings.FIRST_ADMIN_EMAIL, help="Admin email address")
    parser.add_argument("--name", default=settings.FIRST_ADMIN_NAME, help="Admin full display name")
    parser.add_argument("--password", default=settings.FIRST_ADMIN_PASSWORD, help="Admin password (or enter interactively)")

    args = parser.parse_args()

    email = args.email
    if not email:
        email = input("Admin Email: ").strip()

    if not email or "@" not in email:
        print("Error: A valid email address is required.", file=sys.stderr)
        sys.exit(1)

    password = args.password
    if not password:
        password = getpass.getpass("Enter Admin Password (min 8 characters): ")
        password_confirm = getpass.getpass("Confirm Admin Password: ")
        if password != password_confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    if len(password) < 8:
        print("Error: Password must be at least 8 characters long.", file=sys.stderr)
        sys.exit(1)

    full_name = args.name or "System Administrator"
    provision_admin(email=email, full_name=full_name, password=password)


if __name__ == "__main__":
    main()
