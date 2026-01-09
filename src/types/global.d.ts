// Global module declarations for non-TS assets imported as side-effects.
// This prevents "Cannot find module or type declarations for side-effect import" errors
// when importing CSS and common static assets in TSX files.

declare module "*.css";
declare module "*.scss";
declare module "*.sass";
declare module "*.less";

declare module "*.png";
declare module "*.jpg";
declare module "*.jpeg";
declare module "*.gif";
declare module "*.svg";
declare module "*.ico";
