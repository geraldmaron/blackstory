import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import {
  Children,
  cloneElement,
  isValidElement,
  type PropsWithChildren,
  type ReactNode,
} from 'react';
import { setResponseHeaders } from 'expo-server';

function withNonce(nodes: ReactNode, nonce: string): ReactNode {
  return Children.map(nodes, (node) =>
    isValidElement(node) &&
    (node.type === 'script' || node.type === 'style' || node.type === 'link')
      ? cloneElement(node as never, { nonce } as never)
      : node,
  );
}

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();
  // Per-request nonce shared with the patched renderer (see patch-render.py); fresh fallback otherwise.
  const store = (globalThis as { __bsNonceStore?: { getStore(): string | undefined } })
    .__bsNonceStore;
  const nonce = store?.getStore() ?? Buffer.from(crypto.randomUUID()).toString('base64');
  setResponseHeaders({
    'Content-Security-Policy': `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`,
    'x-nonce': nonce,
  });
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        {withNonce(headNodes, nonce)}
      </head>
      <body {...bodyAttributes}>
        {children}
        {withNonce(bodyNodes, nonce)}
      </body>
    </html>
  );
}
