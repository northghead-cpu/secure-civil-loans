import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type SparklesCoreProps = {
  id?: string;
  className?: string;
  background?: string;
  particleSize?: number;
  minSize?: number;
  maxSize?: number;
  speed?: number;
  particleColor?: string;
  particleDensity?: number;
};

export const SparklesCore = ({
  className,
  particleColor = "#FFFFFF",
  particleDensity = 50,
  minSize = 1,
  maxSize = 3,
}: SparklesCoreProps) => {
  // Generate random sparkle positions with different animation groups
  const sparkles = React.useMemo(() => {
    return Array.from({ length: particleDensity }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * (maxSize - minSize) + minSize,
      delay: Math.random() * 3,
      duration: Math.random() * 2 + 2,
      group: i % 3, // 3 different animation groups
    }));
  }, [particleDensity, minSize, maxSize]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className="absolute rounded-full"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: `${sparkle.size}px`,
            height: `${sparkle.size}px`,
            backgroundColor: particleColor,
          }}
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [0.8, 1.2, 0.8],
            y: sparkle.group === 0 ? [-10, 10, -10] : sparkle.group === 1 ? [-15, 15, -15] : [-5, 5, -5],
            rotate: sparkle.group === 1 ? [0, 180, 360] : 0,
          }}
          transition={{
            duration: sparkle.duration,
            delay: sparkle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};