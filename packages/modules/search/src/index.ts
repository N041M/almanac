// @almanac/search — on-demand ranked search (roadmap P8 findability). Pure
// logic over a flat SearchDoc corpus the app assembles from every module's
// state (L1: the app composes; modules never see each other). A module that
// contributes no docs simply isn't searchable (L5). Depends on core only.

export type { SearchDoc, SearchHit } from './types.js';
export { searchDocs, DEFAULT_SEARCH_LIMIT } from './search.js';

export const SEARCH_MODULE_VERSION = '0.0.0';
