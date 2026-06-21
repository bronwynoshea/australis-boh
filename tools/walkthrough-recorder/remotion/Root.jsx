import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const defaultScenes = [
  {
    title: "Talent Onboarding",
    caption: "Create a clean onboarding walkthrough from approved screenshot scenes.",
    imageUrl: "",
    durationSeconds: 5,
  },
];

const fitImage = (sourceWidth, sourceHeight, targetWidth, targetHeight, mode = "cover") => {
  const scale = mode === "contain"
    ? Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
};

const SceneCard = ({ scene, sceneStartFrame, sceneDurationFrames, device = "mobile" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isDesktop = device === "desktop" || width > height;
  const localFrame = Math.max(0, frame - sceneStartFrame);
  const fadeFrames = Math.round(fps * 0.35);
  const opacity = interpolate(
    frame,
    [
      sceneStartFrame - fadeFrames,
      sceneStartFrame,
      sceneStartFrame + sceneDurationFrames - fadeFrames,
      sceneStartFrame + sceneDurationFrames,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const entrance = spring({
    frame: localFrame,
    fps,
    config: {
      damping: 22,
      stiffness: 110,
      mass: 0.8,
    },
  });
  const subtlePan = interpolate(
    localFrame,
    [0, sceneDurationFrames],
    [0, -18],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const captionOpacity = interpolate(localFrame, [8, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const frameWidth = isDesktop ? 1640 : 820;
  const frameHeight = isDesktop ? 830 : 1460;
  const frameLeft = (width - frameWidth) / 2;
  const frameTop = isDesktop ? 155 : 215;
  const frameRadius = isDesktop ? 30 : 46;
  const imageSize = isDesktop
    ? fitImage(1440, 900, frameWidth, frameHeight, "contain")
    : fitImage(390, 844, frameWidth, frameHeight, "cover");

  if (isDesktop) {
    const desktopImageSize = fitImage(1440, 900, width, height, "cover");
    const desktopZoom = interpolate(localFrame, [0, sceneDurationFrames], [1.01, 1.035], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <AbsoluteFill
        style={{
          background: "#110b21",
          color: "white",
          fontFamily: "Inter, Arial, sans-serif",
          overflow: "hidden",
          opacity,
        }}
      >
        {scene.imageUrl ? (
          <Img
            src={scene.imageUrl}
            style={{
              position: "absolute",
              width: desktopImageSize.width,
              height: desktopImageSize.height,
              left: (width - desktopImageSize.width) / 2,
              top: (height - desktopImageSize.height) / 2,
              objectFit: "cover",
              transform: `scale(${desktopZoom})`,
            }}
          />
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(17, 11, 33, 0.1) 0%, rgba(17, 11, 33, 0) 42%, rgba(17, 11, 33, 0.76) 100%)",
          }}
        />

        {scene.id === "talent-onboarding-work-email" ? (
          <div
            style={{
              position: "absolute",
              left: 536,
              top: 391,
              width: 840,
              height: 74,
              borderRadius: 15,
              background: "#784574",
              display: "flex",
              alignItems: "center",
              paddingLeft: 24,
              color: "rgba(255,255,255,0.96)",
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            sally@jobzcafe.com
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            left: 56,
            right: 56,
            bottom: 44,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 36,
          }}
        >
          <div style={{ maxWidth: 980 }}>
            <div
              style={{
                fontSize: 34,
                lineHeight: 1.12,
                fontWeight: 760,
                letterSpacing: 0,
                textShadow: "0 2px 18px rgba(0,0,0,0.35)",
              }}
            >
              {scene.title}
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 24,
                lineHeight: 1.35,
                fontWeight: 520,
                color: "rgba(255,255,255,0.9)",
                textShadow: "0 2px 18px rgba(0,0,0,0.35)",
              }}
            >
              {scene.caption}
            </div>
          </div>
          <div
            style={{
              borderRadius: 999,
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.24)",
              padding: "12px 18px",
              fontSize: 18,
              fontWeight: 650,
              backdropFilter: "blur(10px)",
            }}
          >
            Talent onboarding
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #101735 0%, #f8fafc 56%, #eef2ff 100%)",
        color: "white",
        fontFamily: "Inter, Arial, sans-serif",
        overflow: "hidden",
        opacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: isDesktop ? 46 : 72,
          left: 74,
          width: width - 148,
          fontSize: isDesktop ? 42 : 46,
          lineHeight: 1.12,
          fontWeight: 760,
          letterSpacing: 0,
        }}
      >
        {scene.title}
      </div>

      <div
        style={{
          position: "absolute",
          left: frameLeft - 18,
          top: frameTop - 18,
          width: frameWidth + 36,
          height: frameHeight + 36,
          borderRadius: isDesktop ? 42 : 64,
          background: "#0f172a",
          boxShadow: "0 28px 60px rgba(15, 23, 42, 0.28)",
          transform: `translateY(${interpolate(entrance, [0, 1], [42, 0])}px) scale(${interpolate(entrance, [0, 1], [0.965, 1])})`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: frameLeft,
          top: frameTop,
          width: frameWidth,
          height: frameHeight,
          borderRadius: frameRadius,
          overflow: "hidden",
          background: "white",
          transform: `translateY(${interpolate(entrance, [0, 1], [42, 0])}px) scale(${interpolate(entrance, [0, 1], [0.965, 1])})`,
        }}
      >
        {scene.imageUrl ? (
          <Img
            src={scene.imageUrl}
            style={{
              position: "absolute",
              width: imageSize.width,
              height: imageSize.height,
              left: (frameWidth - imageSize.width) / 2,
              top: (frameHeight - imageSize.height) / 2 + (isDesktop ? 0 : subtlePan),
              objectFit: isDesktop ? "contain" : "cover",
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          position: "absolute",
          left: 80,
          top: isDesktop ? height - 110 : height - 190,
          width: width - 160,
          color: "#111827",
          fontSize: isDesktop ? 30 : 35,
          lineHeight: 1.35,
          fontWeight: 520,
          opacity: captionOpacity,
        }}
      >
        {scene.caption}
      </div>
    </AbsoluteFill>
  );
};

const WalkthroughVideo = ({ scenes = defaultScenes, device = "mobile" }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  let cursor = 0;

  return (
    <AbsoluteFill style={{ background: "#0f172a" }}>
      {scenes.map((scene, index) => {
        const duration = Math.max(1, Math.round((scene.durationSeconds || 5) * fps));
        const sceneStart = cursor;
        cursor += duration;
        const fadeFrames = Math.round(fps * 0.35);
        const isVisible = frame >= sceneStart - fadeFrames && frame < sceneStart + duration;

        return isVisible ? (
          <SceneCard
            key={scene.id || index}
            scene={scene}
            sceneStartFrame={sceneStart}
            sceneDurationFrames={duration}
            device={device}
          />
        ) : null;
      })}
    </AbsoluteFill>
  );
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="WalkthroughVideo"
      component={WalkthroughVideo}
      durationInFrames={900}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        scenes: defaultScenes,
      }}
    />
  );
};
