#!/bin/sh
# usage: round.sh N [skip]  — refresh queue from DB and print the next N items needing hand work
npx tsx scripts/sk-export.ts --n=5000 --out=ops/sk-work/all-remaining.json | tail -1
python3 ops/sk-work/skgen.py stats
python3 ops/sk-work/skgen.py work "$1" "${2:-0}"
