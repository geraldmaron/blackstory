/**
 * The wait for /lives: the page's own sand mast and paper sheet, with a blank ruled ledger on it.
 * Also the wait for `/lives/explorer`, which awaits the same snapshot read.
 */
import React from 'react';
import { PageHeader } from '@repo/ui';
import { Room } from '../../components/room';
import { TrustMast, TrustSheet } from '../../components/trust';
import '../../components/room/catalog-loading.css';

void React;

export default function Loading() {
  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast>
          <PageHeader
            display
            title={
              <span role="status" aria-live="polite">
                Finding the lives…
              </span>
            }
            dek="Each life is traced to its sources."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <div aria-busy="true" className="ds-wait">
          <div className="ds-wait__ledger" aria-hidden="true">
            <span className="ds-wait__rule ds-wait__rule--lead">
              <span className="ds-wait__pin" />
            </span>
            <span className="ds-wait__rule" />
            <span className="ds-wait__rule" />
            <span className="ds-wait__rule" />
          </div>
        </div>
      </TrustSheet>
    </Room>
  );
}
