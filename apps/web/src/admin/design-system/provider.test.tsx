import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
void React;
import { renderToStaticMarkup } from 'react-dom/server';
import { Input } from 'baseui/input';
import { Button } from 'baseui/button';
import { Provider } from 'styletron-react';
import { Server } from 'styletron-engine-monolithic';
import { AdminDesignProvider } from './provider';

test('server-rendered subpath controls receive the admin theme rather than Base defaults', () => {
  const controls = (
    <>
      <Input id="theme-fixture" />
      <Button>Sign in</Button>
    </>
  );
  const branded = renderToStaticMarkup(<AdminDesignProvider>{controls}</AdminDesignProvider>);
  const defaults = renderToStaticMarkup(<Provider value={new Server()}>{controls}</Provider>);
  for (const control of ['input', 'button']) {
    const selector = new RegExp(`data-baseweb="${control}"[^>]*class="([^"]+)"`);
    const brandedClass = branded.match(selector)?.[1];
    const defaultClass = defaults.match(selector)?.[1];
    assert.ok(brandedClass, `Rendered ${control} must have generated styles`);
    assert.ok(defaultClass);
    assert.notEqual(brandedClass, defaultClass, `${control} lost the admin theme context`);
  }
});
