# Anthropomorphic Size Diff tool!

Find it at https://size-diff.snowsune.net/


## Development

Python via pipenv, Painter's Canvas via npm (straight from github, no vendoring).

```shell
npm install
pipenv shell
flask run --debug
```

That pulls [painters-canvas](https://github.com/snowsune/PaintersCanvas) into `node_modules`. Flask serves it from `/lib/painters-canvas/...`.


## Docker

The image runs `npm install` so it grabs Painter's Canvas from git at build time. Same deal, no checked-in vendor tree.

(If youd rather submodule it someday, cool, but npm-from-git is what we ship with.)


## Artists!

None so far! Be the first!
