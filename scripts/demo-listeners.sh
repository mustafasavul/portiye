#!/bin/sh
# Throwaway listeners to try sweeps, kills and families against.
#
#   sh scripts/demo-listeners.sh up     → 9 listeners on :7001-:7104
#   sh scripts/demo-listeners.sh down   → kill them all
#   sh scripts/demo-listeners.sh list   → what is still up
#
# Two of them are supervisor trees (parent listens, child does the work), which
# is the `dotnet watch` / `npm run dev` shape a kill has to take down whole.

list() {
  lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null |
    awk '$9 ~ /:7[01][0-9][0-9]$/ {print $1, "pid", $2, $9}' | sort -k4
}

py() { python3 -m http.server "$1" --bind 127.0.0.1 >/dev/null 2>&1 & }
nd() {
  node -e "require('http').createServer((_,r)=>r.end('ok')).listen($1,'127.0.0.1')" \
    >/dev/null 2>&1 &
}

case "$1" in
up)
  cd /tmp || exit 1
  py 7001; py 7002; py 7003
  # :7005 is the parent, :7004 the child it spawned.
  sh -c 'python3 -m http.server 7004 --bind 127.0.0.1 >/dev/null 2>&1 &
         exec python3 -m http.server 7005 --bind 127.0.0.1' >/dev/null 2>&1 &
  nd 7101; nd 7102
  # :7103 is the parent, :7104 the child.
  node -e "
    const {spawn} = require('child_process');
    spawn(process.execPath, ['-e', \"require('http').createServer((_,r)=>r.end('child')).listen(7104,'127.0.0.1')\"], {stdio:'ignore'});
    require('http').createServer((_,r)=>r.end('parent')).listen(7103,'127.0.0.1');
  " >/dev/null 2>&1 &
  sleep 2
  list
  ;;
down)
  pkill -f "http.server 70"
  pkill -f "createServer"
  sleep 1
  echo "left:"
  list
  ;;
list)
  list
  ;;
*)
  echo "usage: sh scripts/demo-listeners.sh up|down|list" >&2
  exit 1
  ;;
esac
