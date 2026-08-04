import Link from "next/link";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

export type ERPButtonVariant =
  | "primary"
  | "gold"
  | "secondary"
  | "ghost"
  | "success"
  | "danger";

export type ERPButtonSize = "sm" | "md" | "lg";

interface CommonProps {
  children: ReactNode;
  className?: string;
  variant?: ERPButtonVariant;
  size?: ERPButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type LinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type ERPButtonProps = ButtonProps | LinkProps;

/** One button implementation for actions and navigation links. */
export default function ERPButton(props: ERPButtonProps) {
  const {
    children,
    className = "",
    variant = "primary",
    size = "md",
    loading = false,
    leadingIcon,
    trailingIcon,
    fullWidth = false,
  } = props;

  const classes = [
    "erp2-button",
    `erp2-button--${variant}`,
    `erp2-button--${size}`,
    fullWidth ? "erp2-button--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {loading ? <span className="erp2-button__spinner" aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </>
  );

  if ("href" in props && props.href) {
    const { href, target, rel, ...anchorProps } = props;
    return (
      <Link
        href={href}
        className={classes}
        target={target}
        rel={rel}
        aria-disabled={loading || undefined}
        onClick={(event) => {
          if (loading) event.preventDefault();
          anchorProps.onClick?.(event);
        }}
      >
        {content}
      </Link>
    );
  }

  const {
    disabled,
    type = "button",
    onClick,
    name,
    value,
    form,
    title,
    id,
    tabIndex,
    autoFocus,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
  } = props as ButtonProps;

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      onClick={onClick}
      name={name}
      value={value}
      form={form}
      title={title}
      id={id}
      tabIndex={tabIndex}
      autoFocus={autoFocus}
    >
      {content}
    </button>
  );
}
