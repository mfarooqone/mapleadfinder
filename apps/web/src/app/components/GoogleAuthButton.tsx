"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { postJson } from "@/lib/backend";
import {
  clearAuthSession,
  setAuthSession,
  type LoginResponse,
} from "@/lib/auth";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccounts = {
  accounts: {
    id: {
      initialize(input: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }): void;
      renderButton(
        element: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          text: "signin_with" | "signup_with";
          shape: "rectangular";
          logo_alignment: "left";
          width: number;
        },
      ): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

type GoogleAuthButtonProps = {
  mode: "signin" | "signup";
  onSuccess: () => void;
  onError: (message: string) => void;
};

const GOOGLE_SCRIPT_ID = "google-identity-services";

export default function GoogleAuthButton({
  mode,
  onSuccess,
  onError,
}: GoogleAuthButtonProps) {
  const elementId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const renderButton = () => {
      if (!window.google || !containerRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          if (!response.credential) {
            onError("Google sign-in did not return a credential.");
            return;
          }

          setLoading(true);
          try {
            const session = await postJson<
              LoginResponse,
              { credential: string }
            >("/auth/google", {
              credential: response.credential,
            });

            if (!setAuthSession(session)) {
              clearAuthSession();
              onError("Cookies are blocked. Enable cookies and try again.");
              return;
            }

            onSuccess();
          } catch (error) {
            onError(
              error instanceof Error
                ? error.message
                : "Google sign-in failed. Try again.",
            );
          } finally {
            setLoading(false);
          }
        },
      });

      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: mode === "signin" ? "signin_with" : "signup_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 320,
      });
    };

    if (window.google) {
      renderButton();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", renderButton, { once: true });
      return () => existingScript.removeEventListener("load", renderButton);
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    script.onerror = () => onError("Could not load Google sign-in.");
    document.head.appendChild(script);
  }, [clientId, mode, onError, onSuccess]);

  if (!clientId) {
    return null;
  }

  return (
    <div className="relative flex min-h-10 justify-center">
      <div id={elementId} ref={containerRef} />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center rounded border border-neutral-200 bg-white/80">
          <LoaderCircle className="h-4 w-4 animate-spin text-neutral-600" />
        </div>
      ) : null}
    </div>
  );
}
