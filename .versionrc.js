// .versionrc.js -- config for commit-and-tag-version (the release step in scripts/dist.js).
//
// issuePrefixes exists to stop the changelog inventing issue links. conventional-changelog
// treats a bare '#' as an issue reference, and this repo's commit bodies are full of hex
// colours and CSS selectors: '#0f7f55', '#ff6b6b', '.hdr/.seg/#footer-status'. The first
// generated changelog turned every one of those into a link to a GitHub issue that does
// not exist, which is worse than no link at all -- a reader cannot tell the dead ones from
// the real ones. Requiring the explicit 'GH-123' form means a reference in the changelog
// is a reference someone meant to write.
module.exports = {
  parserOpts: {
    issuePrefixes: ['GH-'],
  },
};
