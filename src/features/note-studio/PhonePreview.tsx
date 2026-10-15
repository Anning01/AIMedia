import {
HeartOutlined,
MessageOutlined,
ShareAltOutlined,
StarOutlined,
} from "@/components/shared/icons";
import { useEffect,useState } from "react";
import { formatCount } from "./model";
export interface PhonePreviewProps {
  images: string[];
  title: string;
  paras: string[];
  tags: string[];
  author: string;
  avatar?: string;
  liked?: string | number;
  collected?: string | number;
  comment?: string | number;
  emptyHint: string;
}

export function XhsPhonePreview({
  images,
  title,
  paras,
  tags,
  author,
  avatar,
  liked,
  collected,
  comment,
  emptyHint,
}: PhonePreviewProps) {
  const [idx, setIdx] = useState(0);
  const count = images.length;
  useEffect(() => {
    if (count > 0 && idx >= count) setIdx(0);
  }, [count, idx]);
  const step = (d: number) => {
    if (!count) return;
    setIdx((i) => (i + d + count) % count);
  };
  const body = paras.length ? paras.join("\n\n") : "";
  const actionStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    color: "#4b5263",
  };
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "8px 0 2px",
      }}
    >
      <div
        style={{
          width: 302,
          borderRadius: 40,
          background: "#0f1115",
          padding: 9,
          boxShadow: "0 16px 40px rgba(15,17,21,.28)",
        }}
      >
        <div
          style={{
            borderRadius: 32,
            background: "#f7f7f7",
            height: 600,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: 40,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              borderBottom: "1px solid #f0f0f0",
              position: "relative",
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#ff2442",
                letterSpacing: 1,
              }}
            >
              小红书
            </span>
            <span
              style={{
                position: "absolute",
                right: 14,
                fontSize: 13,
                color: "#999",
                letterSpacing: 1,
              }}
            >
              ···
            </span>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {avatar ? (
                <img
                  src={avatar}
                  alt={author}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    objectFit: "cover",
                    background: "#eee",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#ff6b81,#ff2442)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {author.slice(0, 1) || "种"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#222" }}>
                  {author}
                </div>
                <div style={{ fontSize: 10, color: "#999", marginTop: 1 }}>
                  刚刚
                </div>
              </div>
              <span
                style={{
                  color: "#ff2442",
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                + 关注
              </span>
            </div>

            <div
              style={{
                marginTop: 10,
                borderRadius: 10,
                overflow: "hidden",
                background: "#000",
                aspectRatio: "3/4",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {count > 0 ? (
                <>
                  <img
                    src={images[idx]}
                    alt={`配图 ${idx + 1}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {count > 1 && (
                    <>
                      <div
                        onClick={() => step(-1)}
                        style={{
                          position: "absolute",
                          left: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "rgba(0,0,0,.45)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        ‹
                      </div>
                      <div
                        onClick={() => step(1)}
                        style={{
                          position: "absolute",
                          right: 8,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: "rgba(0,0,0,.45)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        ›
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          right: 8,
                          bottom: 8,
                          background: "rgba(0,0,0,.55)",
                          color: "#fff",
                          fontSize: 10,
                          padding: "2px 8px",
                          borderRadius: 10,
                        }}
                      >
                        {idx + 1} / {count}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div
                  style={{
                    color: "#8a93a6",
                    fontSize: 12,
                    textAlign: "center",
                    padding: "0 24px",
                    lineHeight: 1.8,
                  }}
                >
                  {emptyHint}
                </div>
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  color: "#1f2430",
                }}
              >
                {title || "笔记标题"}
              </div>
              {body && (
                <div
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.8,
                    color: "#3d4352",
                    marginTop: 6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {body}
                </div>
              )}
              {tags.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  {tags.map((t) => (
                    <span key={t} style={{ color: "#0f7e7e", fontSize: 12 }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              height: 46,
              flexShrink: 0,
              background: "#fff",
              borderTop: "1px solid #f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-around",
              fontSize: 12,
              padding: "0 8px",
            }}
          >
            <span style={actionStyle}>
              <HeartOutlined style={{ fontSize: 18 }} />
              <span>{formatCount(liked) || "点赞"}</span>
            </span>
            <span style={actionStyle}>
              <StarOutlined style={{ fontSize: 18 }} />
              <span>{formatCount(collected) || "收藏"}</span>
            </span>
            <span style={actionStyle}>
              <MessageOutlined style={{ fontSize: 18 }} />
              <span>{formatCount(comment) || "评论"}</span>
            </span>
            <span style={actionStyle}>
              <ShareAltOutlined style={{ fontSize: 18 }} />
              <span>分享</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
