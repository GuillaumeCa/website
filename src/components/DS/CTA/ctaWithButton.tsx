import Link from "next/link";
import { Typography } from "@components/DS/typography";
import { SectionLayout } from "@feat/landing/section-layout";
import { Button } from "@ui/button";

export type CtaWithButtonProps = {
  title: string;
  btContent: string;
  size?: "xs" | "sm" | "base" | "lg" | "full";
  href?: string;
};

export const CtaWithButton = (props: CtaWithButtonProps) => {
  return (
    <SectionLayout
      variant="primary"
      className="flex flex-col items-center justify-center gap-10 uppercase"
      size={props.size ?? "sm"}
    >
      <Typography
        variant="h2"
        className="text-primary-foreground line-clamp-3 text-center text-4xl uppercase"
      >
        {props.title}
      </Typography>
      {props.href ? (
          <Button variant="invert" size="xl" className="w-full" asChild={true}>
            <Link href={props.href}>{props.btContent}</Link>
          </Button>
      ) : (
        <Button variant="invert" size="xl" className="w-full">
          {props.btContent}
        </Button>
      )}
    </SectionLayout>
  );
};

