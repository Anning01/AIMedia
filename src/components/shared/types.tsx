import React from "react";

export type Base = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  size?: any;
  [key: string]: any;
};
