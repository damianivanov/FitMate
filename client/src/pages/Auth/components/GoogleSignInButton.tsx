import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router";
import { authService } from "@/services/authService";
import { useUserStore } from "@/stores/userStore";

type GoogleSignInButtonProps = {
  onError?: (message: string) => void;
};

const GOOGLE_MAX_BUTTON_WIDTH = 400;

export default function GoogleSignInButton({ onError }: GoogleSignInButtonProps) {
  const navigate = useNavigate();
  const { initUser } = useUserStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      setWidth(Math.min(Math.round(element.offsetWidth), GOOGLE_MAX_BUTTON_WIDTH));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);
  const handleCredential = async (credential?: string) => {
    if (!credential) {
      onError?.("Google sign-in failed. Please try again.");
      return;
    }

    setIsProcessing(true);
    onError?.("");

    try {
      const response = await authService.googleLogin({ credential });
      const result = response.data;

      if (!result.success) {
        onError?.(result.error ?? "Google sign-in failed.");
        return;
      }

      await initUser();
      navigate("/");
    } catch (submissionError) {
      const message = axios.isAxiosError(submissionError)
        ? (submissionError.response?.data?.error as string | undefined) ?? submissionError.message
        : "Google sign-in failed.";
      onError?.(message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div ref={containerRef} aria-busy={isProcessing} className="w-full">
      {width > 0 ? (
        <GoogleLogin
          onSuccess={(response) => handleCredential(response.credential)}
          onError={() => onError?.("Google sign-in failed. Please try again.")}
          text="continue_with"
          logo_alignment="center"
          shape="pill"
          useOneTap={true}
          width={width}
        />
      ) : null}
    </div>
  );
}
