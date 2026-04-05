import React from 'react';
import { renderToString } from 'react-dom/server';
import { Sparkles } from 'lucide-react';
console.log(renderToString(<Sparkles color="url(#bluish-purple-gradient)" />));
