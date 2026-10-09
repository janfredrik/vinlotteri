import "react";

// The <vipps-mobilepay-button> custom element from
// https://cdn.vippsmobilepay.com/js/button/button.js — all attributes are strings.
type VippsMobilepayButtonAttributes = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  brand?: "vipps" | "mobilepay";
  language?: "no" | "en" | "da" | "fi";
  variant?: "primary" | "secondary";
  rounded?: "true" | "false";
  verb?: "pay" | "buy" | "order" | "book" | "continue" | "donate" | "subscribe" | "register";
  stretched?: "true" | "false";
  compact?: "true" | "false";
  loading?: "true" | "false";
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "vipps-mobilepay-button": VippsMobilepayButtonAttributes;
    }
  }
}
