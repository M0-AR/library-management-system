#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

sed -e 's|src="docs/|src="../docs/|g' \
    -e 's|href="docs/|href="../docs/|g' \
    -e 's|href="README\.md|href="../README.md|g' \
    -e 's|href="frontend/|href="../frontend/|g' \
    -e 's|href="backend/|href="../backend/|g' \
    -e 's|href="SECURITY\.md"|href="../SECURITY.md"|g' \
    -e 's|href="CONTRIBUTING\.md"|href="../CONTRIBUTING.md"|g' \
    -e 's|href="LICENSE"|href="../LICENSE"|g' \
    preview.html > docs/preview.html

cp docs/preview.html docs/index.html
touch .nojekyll docs/.nojekyll
echo "wrote docs/preview.html, docs/index.html, .nojekyll, docs/.nojekyll"
