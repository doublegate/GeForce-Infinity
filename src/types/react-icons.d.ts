/// <reference types="react" />
/// <reference types="react-dom" />

declare module "react-icons/fa" {
  import { IconType } from "react-icons";
  export const FaInfoCircle: IconType;
  export const FaSync: IconType;
  export const FaGithub: IconType;
  export const FaGlobeAmericas: IconType;
  export const FaPatreon: IconType;
  export const FaCloudDownloadAlt: IconType;
}

declare module "react-icons/fa6" {
  import { IconType } from "react-icons";
  export const FaCircleUser: IconType;
  export const FaCircleCheck: IconType;
  export const FaCircleXmark: IconType;
  export const FaTriangleExclamation: IconType;
  export const FaMicrochip: IconType;
  export const FaDisplay: IconType;
  export const FaVideo: IconType;
}

declare module "react-icons" {
  import * as React from "react";
  
  export interface IconBaseProps extends React.SVGAttributes<SVGElement> {
    children?: React.ReactNode;
    size?: string | number;
    color?: string;
    title?: string;
  }

  export type IconType = (props: IconBaseProps) => JSX.Element;
}