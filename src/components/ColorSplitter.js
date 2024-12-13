import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';

const ColorSplitter = () => {
  const [image, setImage] = useState(null);
  const [colors, setColors] = useState([]);
  const [status, setStatus] = useState('');
  const [downloadLink, setDownloadLink] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }
    },
  });

  const processFile = (file) => {
    setImage(URL.createObjectURL(file));
    setStatus('Processing...');
    setColors([]);
    setDownloadLink(null);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const colorsList = findColors(imageData.data);
      setColors(colorsList);
      setStatus(`Found ${colorsList.length} colors. Separating...`);
      separateColors(colorsList, imageData);
    };
    img.src = URL.createObjectURL(file);
  };

  const findColors = (data) => {
    const colors = {};
    for (let i = 0; i < data.length; i += 4) {
      const key = data[i] + ',' + data[i + 1] + ',' + data[i + 2];
      colors[key] = (colors[key] || 0) + 1;
    }
    return Object.entries(colors)
      .filter(([, count]) => count > 100)
      .map(([color]) => color.split(',').map(Number))
      .sort((a, b) => b[0] + b[1] + b[2] - a[0] - a[1] - a[2]);
  };

  const separateColors = (colorsList, imageData) => {
    const zip = new JSZip();
    const promises = [];

    for (const color of colorsList) {
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      const separatedData = new Uint8ClampedArray(imageData.data.length);

      for (let i = 0; i < imageData.data.length; i += 4) {
        if (
          Math.abs(imageData.data[i] - color[0]) < 30 &&
          Math.abs(imageData.data[i + 1] - color[1]) < 30 &&
          Math.abs(imageData.data[i + 2] - color[2]) < 30
        ) {
          separatedData[i] = color[0];
          separatedData[i + 1] = color[1];
          separatedData[i + 2] = color[2];
          separatedData[i + 3] = imageData.data[i + 3];
        }
      }

      ctx.putImageData(new ImageData(separatedData, imageData.width, imageData.height), 0, 0);

      const colorHex = ((1 << 24) + (color[0] << 16) + (color[1] << 8) + color[2]).toString(16).slice(1).toUpperCase();
      const filename = `color_${colorHex}.png`;

      promises.push(
        new Promise((resolve) => {
          canvas.toBlob((blob) => {
            zip.file(filename, blob);
            resolve();
          }, 'image/png');
        })
      );
    }

    Promise.all(promises).then(() => {
      zip.generateAsync({ type: 'blob' }).then((content) => {
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'color_separations.zip';
        setDownloadLink(link);
        setStatus(`Processed ${colors.length} colors. Click the button to download.`);
      });
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-8">Color Splitter</h1>
      <div
        {...getRootProps()}
        className={`w-full max-w-md p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragActive ? 'bg-gray-200' : 'bg-white hover:bg-gray-200'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-500 text-center">
          {isDragActive ? 'Drop the image here' : 'Drag and drop an image, or click to select a file'}
        </p>
      </div>
      {image && <img src={image} alt="Preview" className="max-w-md mt-8 rounded-lg shadow-lg" />}
      <p className="mt-4 text-gray-500">{status}</p>
      {downloadLink && (
        <a
          href={downloadLink.href}
          download={downloadLink.download}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Download color separations
        </a>
      )}
    </div>
  );
};

export default ColorSplitter;