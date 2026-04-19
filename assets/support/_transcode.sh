#!/usr/bin/env bash
# Transcode SUPPORT videos to web-friendly H.264 720p + extract thumbnails.
# Source: /assets/Contenu brut Don Low/SUPPORT/*
# Output: /assets/support/clip-XX.mp4 + clip-XX.jpg
set -e

SRC="/Users/joshtorrent/Documents/Claude/Projects/don low-epk v2/assets/Contenu brut Don Low/SUPPORT"
DST="/Users/joshtorrent/Documents/Claude/Projects/don low-epk v2/assets/support"

# Pairs: "source_filename|clip-NN"
FILES=(
  "Nasthug @ Bailer Room - NY Girls.MP4|clip-01"
  "Cut Killer @ France2 TV.mp4|clip-02"
  "Rain Katayanagi @ Glastonbury UK.mp4|clip-03"
  "Tropkillaz x Klean_Apashe.MP4|clip-04"
  "Untalasalsa @ Boiler Room.MP4|clip-05"
  "Mau Moctezuma @ Antidoto Club.MOV|clip-06"
  "Tye Turner @ Syber.exp.mov|clip-07"
  "Baby J @ Syber Asia.mov|clip-08"
  "Akalex_NY Girls.MP4|clip-09"
  "SANTO @ Polonia.mov|clip-10"
  "Mabrada @ Baile Trama.MP4|clip-11"
  "@tye_turner and @babyj4lyfe @ syber.exp.mp4|clip-12"
)

for pair in "${FILES[@]}"; do
  src_name="${pair%|*}"
  out_slug="${pair#*|}"
  src_path="$SRC/$src_name"
  out_mp4="$DST/$out_slug.mp4"
  out_jpg="$DST/$out_slug.jpg"

  if [[ ! -f "$src_path" ]]; then
    echo "[skip] missing source: $src_name"
    continue
  fi

  echo "[$(date +%H:%M:%S)] transcoding $out_slug ← $src_name"

  # Main transcode: H.264, 720p max, ~2.5Mbps ballpark (CRF 26 VBR), AAC 128k, faststart.
  ffmpeg -hide_banner -loglevel error -y \
    -i "$src_path" \
    -vcodec libx264 -preset medium -crf 26 \
    -vf "scale='if(gt(a,1),-2,720)':'if(gt(a,1),720,-2)',format=yuv420p" \
    -acodec aac -b:a 128k -ac 2 \
    -movflags +faststart \
    "$out_mp4"

  # Thumbnail: mid-ish frame for visual interest. Match video orientation.
  ffmpeg -hide_banner -loglevel error -y \
    -ss 00:00:02 -i "$src_path" -vframes 1 \
    -vf "scale='if(gt(a,1),-2,720)':'if(gt(a,1),720,-2)'" -q:v 4 \
    "$out_jpg"

  src_size=$(du -h "$src_path" | cut -f1)
  out_size=$(du -h "$out_mp4" | cut -f1)
  echo "  → $out_size (was $src_size)"
done

echo "[$(date +%H:%M:%S)] done."
