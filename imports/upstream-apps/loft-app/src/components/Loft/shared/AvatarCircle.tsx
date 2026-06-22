import React, { useEffect, useMemo, useState } from "react";

function getInitials(name?: string | null) {
  const s = (name || "").trim();
  if (!s) return "??";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (a + b).toUpperCase() || "??";
}

export default function AvatarCircle({
  avatarUrl,
  name,
  size,
  className = "",
  initialsClassName = "text-xs font-semibold text-white/80",
}: {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  initialsClassName?: string;
}) {
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    setImgOk(true);
  }, [avatarUrl]);

  const src = useMemo(() => {
    const u = (avatarUrl || "").trim();
    if (!u) return null;
    // Use as-is. If it's 404, onError will swap to initials.
    return u;
  }, [avatarUrl]);

  const initials = useMemo(() => getInitials(name), [name]);
  const inlineSize =
    typeof size === "number" && size > 0 ? { width: size, height: size } : undefined;

  return (
    <div
      className={`rounded-full overflow-hidden flex items-center justify-center bg-white/10 ${className}`}
      style={inlineSize}
    >
      {src && imgOk ? (
        <img
          src={src}
          alt={name || "Avatar"}
          className="h-full w-full object-cover"
          onError={() => setImgOk(false)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className={initialsClassName}>{initials}</span>
      )}
    </div>
  );
}
