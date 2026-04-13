"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PupilProps = {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
};

function Pupil({ size = 12, maxDistance = 5, pupilColor = "#2D2D2D" }: PupilProps) {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const pos = useMemo(() => {
    if (!pupilRef.current) return { x: 0, y: 0 };
    const rect = pupilRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  }, [mouseX, mouseY, maxDistance]);

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 0.1s ease-out",
      }}
    />
  );
}

type EyeBallProps = {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
};

function EyeBall({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "#2D2D2D",
  isBlinking = false,
}: EyeBallProps) {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const pos = useMemo(() => {
    if (!eyeRef.current) return { x: 0, y: 0 };
    const rect = eyeRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  }, [mouseX, mouseY, maxDistance]);

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? "2px" : `${size}px`,
        backgroundColor: eyeColor,
        overflow: "hidden",
      }}
    >
      {!isBlinking ? (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      ) : null}
    </div>
  );
}

function useBlink() {
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    const getRandomBlinkInterval = () => Math.random() * 4000 + 3000;
    let timeout: number | undefined;
    const schedule = () => {
      timeout = window.setTimeout(() => {
        setIsBlinking(true);
        window.setTimeout(() => {
          setIsBlinking(false);
          schedule();
        }, 150);
      }, getRandomBlinkInterval());
    };
    schedule();
    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, []);

  return isBlinking;
}

export default function LoginHero() {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  const isPurpleBlinking = useBlink();
  const isBlackBlinking = useBlink();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const calc = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;
    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const faceX = Math.max(-15, Math.min(15, dx / 20));
    const faceY = Math.max(-10, Math.min(10, dy / 30));
    const bodySkew = Math.max(-6, Math.min(6, -dx / 120));
    return { faceX, faceY, bodySkew };
  };

  const purplePos = calc(purpleRef);
  const blackPos = calc(blackRef);
  const yellowPos = calc(yellowRef);
  const orangePos = calc(orangeRef);

  return (
    <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden h-full">
      <div className="relative z-20 h-full">
        <div className="absolute inset-0">
          <div
            ref={purpleRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: "130px",
              width: "300px",
              height: "265px",
              backgroundColor: "#8B5CF6",
              borderRadius: "150px 150px 0 0",
              zIndex: 1,
              transform: `skewX(${purplePos.bodySkew || 0}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            <div
              className="absolute flex gap-8 transition-all duration-200 ease-out"
              style={{
                left: `${92 + (purplePos.faceX || 0)}px`,
                top: `${70 + (purplePos.faceY || 0)}px`,
              }}
            >
              <EyeBall
                size={24}
                pupilSize={10}
                maxDistance={6}
                eyeColor="white"
                pupilColor="#2D2D2D"
                isBlinking={isPurpleBlinking}
              />
              <EyeBall
                size={24}
                pupilSize={10}
                maxDistance={6}
                eyeColor="white"
                pupilColor="#2D2D2D"
                isBlinking={isPurpleBlinking}
              />
            </div>
          </div>

          <div
            ref={blackRef}
            className="absolute bottom-0 transition-all duration-1000 ease-in-out"
            style={{
              left: "0px",
              width: "210px",
              height: "270px",
              backgroundColor: "#2D2D2D",
              borderRadius: "105px 105px 0 0",
              zIndex: 2,
              transform: `skewX(${blackPos.bodySkew || 0}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            <div
              className="absolute flex gap-6 transition-all duration-200 ease-out"
              style={{
                left: `${26 + (blackPos.faceX || 0)}px`,
                top: `${32 + (blackPos.faceY || 0)}px`,
              }}
            >
              <EyeBall
                size={16}
                pupilSize={6}
                maxDistance={4}
                eyeColor="white"
                pupilColor="#2D2D2D"
                isBlinking={isBlackBlinking}
              />
              <EyeBall
                size={16}
                pupilSize={6}
                maxDistance={4}
                eyeColor="white"
                pupilColor="#2D2D2D"
                isBlinking={isBlackBlinking}
              />
            </div>
          </div>

          <div
            ref={orangeRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: "0px",
              width: "240px",
              height: "160px",
              zIndex: 3,
              backgroundColor: "#FF9B6B",
              borderRadius: "120px 120px 0 0",
              transform: `skewX(${orangePos.bodySkew || 0}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            <div
              className="absolute flex gap-8 transition-all duration-200 ease-out"
              style={{
                left: `${82 + (orangePos.faceX || 0)}px`,
                top: `${90 + (orangePos.faceY || 0)}px`,
              }}
            >
              <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" />
              <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" />
            </div>
          </div>

          <div
            ref={yellowRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: "310px",
              width: "140px",
              height: "230px",
              backgroundColor: "#E8D754",
              borderRadius: "70px 70px 0 0",
              zIndex: 4,
              transform: `skewX(${yellowPos.bodySkew || 0}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            <div
              className="absolute flex gap-6 transition-all duration-200 ease-out"
              style={{
                left: `${52 + (yellowPos.faceX || 0)}px`,
                top: `${40 + (yellowPos.faceY || 0)}px`,
              }}
            >
              <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" />
              <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D" />
            </div>
            <div
              className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
              style={{
                left: `${40 + (yellowPos.faceX || 0)}px`,
                top: `${88 + (yellowPos.faceY || 0)}px`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="absolute top-1/4 right-1/4 size-64 bg-primary-foreground/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-1/4 size-96 bg-primary-foreground/5 rounded-full blur-3xl" />
    </div>
  );
}
