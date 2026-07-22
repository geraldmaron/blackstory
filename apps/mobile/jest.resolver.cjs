/**
 * Jest resolver for apps/mobile: map NodeNext `.js` import specifiers under
 * packages/public-contracts to the corresponding `.ts` sources.
 */
const path = require('path');

const publicContractsSrc = path.resolve(__dirname, '../../packages/public-contracts/src');

module.exports = (request, options) => {
  if (
    request.endsWith('.js') &&
    typeof options.basedir === 'string' &&
    options.basedir.startsWith(publicContractsSrc)
  ) {
    const asTs = request.replace(/\.js$/, '.ts');
    try {
      return options.defaultResolver(asTs, options);
    } catch {
      // fall through to default
    }
  }
  return options.defaultResolver(request, options);
};
