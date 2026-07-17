import Image from "next/image";

export function BlackBookBrand({ dark = false }: { dark?: boolean }) {
  const src = dark
    ? "/brand/black-book-primary-dark.svg"
    : "/brand/black-book-primary-light.svg";

  return (
    <Image
      src={src}
      alt="Black Book"
      width={360}
      height={96}
      priority
    />
  );
}
