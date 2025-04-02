#!/bin/zsh

# Tailwind CSS compilation script
npx @tailwindcss/cli -i tailwindcss/static/tailwindcss/css/input.css -o tailwindcss/static/tailwindcss/css/output.css --watch
