// カルマンフィルタシミュレーション - Chart.jsバージョン
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded');
  
  // DOM要素の参照を取得
  const processNoiseSlider = document.getElementById('process-noise-slider');
  const processNoiseValue = document.getElementById('process-noise-value');
  const measurementNoiseSlider = document.getElementById('measurement-noise-slider');
  const measurementNoiseValue = document.getElementById('measurement-noise-value');
  const speedSlider = document.getElementById('speed-slider');
  const speedValue = document.getElementById('speed-value');
  
  // ボタン
  const startStopButton = document.getElementById('start-stop-button');
  const resetButton = document.getElementById('reset-button');
  const stepButton = document.getElementById('step-button');
  
  // 状態表示エリア
  const currentXSpan = document.getElementById('current-x');
  const currentPSpan = document.getElementById('current-p');
  const latestMeasurementDiv = document.getElementById('latest-measurement');
  const filterPerformanceDiv = document.getElementById('filter-performance');
  
  // グラフコンテナ
  const mainChartCanvas = document.getElementById('mainChart');
  const gainChartCanvas = document.getElementById('gainChart');
  
  // Chart.jsが利用可能か確認
  if (typeof Chart === 'undefined') {
    console.error('Chart.js library is not loaded');
    if (mainChartCanvas) {
      const ctx = mainChartCanvas.getContext('2d');
      ctx.font = '16px Arial';
      ctx.fillStyle = 'red';
      ctx.fillText('グラフライブラリの読み込みに失敗しました', 10, 50);
    }
    return;
  }
  
  // カルマンフィルタのパラメータと状態
  let kalmanParams = {
    processNoise: parseFloat(processNoiseSlider ? processNoiseSlider.value : 0.01),
    measurementNoise: parseFloat(measurementNoiseSlider ? measurementNoiseSlider.value : 0.1)
  };
  
  let kalmanState = {
    x: 0,
    P: 1.0,
    K: 0,
    prediction: 0,
    predictionError: 1.0
  };
  
  let simulationState = {
    timeStep: 0,
    isRunning: false,
    speed: parseFloat(speedSlider ? speedSlider.value : 1),
    data: {
      labels: [],
      trueValues: [],
      measurements: [],
      filteredValues: [],
      kalmanGains: []
    },
    intervalId: null
  };
  
  // チャートのインスタンス
  let mainChart = null;
  let gainChart = null;
  
  // スライダーの値が変更されたときのイベントハンドラ
  if (processNoiseSlider) {
    processNoiseSlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      kalmanParams.processNoise = value;
      if (processNoiseValue) processNoiseValue.textContent = value.toFixed(3);
    });
  }
  
  if (measurementNoiseSlider) {
    measurementNoiseSlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      kalmanParams.measurementNoise = value;
      if (measurementNoiseValue) measurementNoiseValue.textContent = value.toFixed(2);
    });
  }
  
  if (speedSlider) {
    speedSlider.addEventListener('input', function() {
      const value = parseFloat(this.value);
      simulationState.speed = value;
      if (speedValue) speedValue.textContent = value.toFixed(1) + 'x';
      
      // シミュレーションが実行中の場合、速度を更新
      if (simulationState.isRunning) {
        clearInterval(simulationState.intervalId);
        simulationState.intervalId = setInterval(simulationStep, 100 / simulationState.speed);
      }
    });
  }
  
  // ボタンのイベントハンドラ
  if (startStopButton) {
    startStopButton.addEventListener('click', function() {
      console.log('Start/Stop button clicked');
      simulationState.isRunning = !simulationState.isRunning;
      
      if (simulationState.isRunning) {
        this.textContent = '停止';
        this.classList.remove('bg-green-500', 'hover:bg-green-600');
        this.classList.add('bg-red-500', 'hover:bg-red-600');
        simulationState.intervalId = setInterval(simulationStep, 100 / simulationState.speed);
        if (stepButton) {
          stepButton.disabled = true;
          stepButton.classList.add('opacity-50');
        }
      } else {
        this.textContent = '開始';
        this.classList.remove('bg-red-500', 'hover:bg-red-600');
        this.classList.add('bg-green-500', 'hover:bg-green-600');
        clearInterval(simulationState.intervalId);
        if (stepButton) {
          stepButton.disabled = false;
          stepButton.classList.remove('opacity-50');
        }
      }
    });
  }
  
  if (resetButton) {
    resetButton.addEventListener('click', function() {
      console.log('Reset button clicked');
      resetSimulation();
    });
  }
  
  if (stepButton) {
    stepButton.addEventListener('click', function() {
      console.log('Step button clicked');
      if (!simulationState.isRunning) {
        simulationStep();
      }
    });
  }
  
  // 測定値の生成
  function generateMeasurement(t) {
    const trueValue = Math.sin(t * 0.1);
    // 測定ノイズを追加
    const noise = (Math.random() - 0.5) * 2 * kalmanParams.measurementNoise;
    const measurement = trueValue + noise;
    return { trueValue, measurement };
  }
  
  // カルマンフィルタの1ステップ
  function kalmanStep(measurement, prevState) {
    const { x, P } = prevState;
    const { processNoise, measurementNoise } = kalmanParams;
    
    // 予測ステップ
    const prediction = x;
    const predictionError = P + processNoise;
    
    // 更新ステップ
    const K = predictionError / (predictionError + measurementNoise);
    const newX = prediction + K * (measurement - prediction);
    const newP = (1 - K) * predictionError;
    
    return {
      x: newX,
      P: newP,
      K: K,
      prediction: prediction,
      predictionError: predictionError
    };
  }
  
  // シミュレーションの1ステップ
  function simulationStep() {
    console.log('Simulation step', simulationState.timeStep);
    if (simulationState.timeStep >= 200) {
      if (simulationState.isRunning) {
        simulationState.isRunning = false;
        if (startStopButton) {
          startStopButton.textContent = '開始';
          startStopButton.classList.remove('bg-red-500', 'hover:bg-red-600');
          startStopButton.classList.add('bg-green-500', 'hover:bg-green-600');
        }
        clearInterval(simulationState.intervalId);
        if (stepButton) {
          stepButton.disabled = false;
          stepButton.classList.remove('opacity-50');
        }
      }
      return;
    }

    const { trueValue, measurement } = generateMeasurement(simulationState.timeStep);
    kalmanState = kalmanStep(measurement, kalmanState);
    
    // データを追加
    simulationState.data.labels.push(simulationState.timeStep);
    simulationState.data.trueValues.push(trueValue);
    simulationState.data.measurements.push(measurement);
    simulationState.data.filteredValues.push(kalmanState.x);
    simulationState.data.kalmanGains.push(kalmanState.K);
    
    simulationState.timeStep += 1;
    
    // UI更新
    updateUI();
  }
  
  // シミュレーションのリセット
  function resetSimulation() {
    simulationState.timeStep = 0;
    simulationState.data = {
      labels: [],
      trueValues: [],
      measurements: [],
      filteredValues: [],
      kalmanGains: []
    };
    kalmanState = {
      x: 0,
      P: 1.0,
      K: 0,
      prediction: 0,
      predictionError: 1.0
    };
    
    if (simulationState.isRunning) {
      simulationState.isRunning = false;
      if (startStopButton) {
        startStopButton.textContent = '開始';
        startStopButton.classList.remove('bg-red-500', 'hover:bg-red-600');
        startStopButton.classList.add('bg-green-500', 'hover:bg-green-600');
      }
      clearInterval(simulationState.intervalId);
      if (stepButton) {
        stepButton.disabled = false;
        stepButton.classList.remove('opacity-50');
      }
    }
    
    // UIをリセット
    if (currentXSpan) currentXSpan.textContent = '0.0000';
    if (currentPSpan) currentPSpan.textContent = '1.0000';
    if (latestMeasurementDiv) latestMeasurementDiv.innerHTML = '<p>まだ測定がありません</p>';
    if (filterPerformanceDiv) filterPerformanceDiv.innerHTML = '<p>まだデータがありません</p>';
    
    // グラフを再描画
    updateCharts();
  }
  
  // UIの更新
  function updateUI() {
    // 現在の状態を更新
    if (currentXSpan) currentXSpan.textContent = kalmanState.x.toFixed(4);
    if (currentPSpan) currentPSpan.textContent = kalmanState.P.toFixed(4);
    
    // 最新の測定を更新
    if (simulationState.data.labels.length > 0 && latestMeasurementDiv) {
      const idx = simulationState.data.labels.length - 1;
      latestMeasurementDiv.innerHTML = `
        <p><strong>時間ステップ:</strong> ${simulationState.data.labels[idx]}</p>
        <p><strong>真の値:</strong> ${simulationState.data.trueValues[idx].toFixed(4)}</p>
        <p><strong>測定値:</strong> ${simulationState.data.measurements[idx].toFixed(4)}</p>
      `;
      
      // フィルタ性能を更新
      if (filterPerformanceDiv) {
        const measurementError = Math.abs(simulationState.data.measurements[idx] - simulationState.data.trueValues[idx]);
        const filterError = Math.abs(simulationState.data.filteredValues[idx] - simulationState.data.trueValues[idx]);
        filterPerformanceDiv.innerHTML = `
          <p><strong>カルマンゲイン (K):</strong> ${kalmanState.K.toFixed(4)}</p>
          <p><strong>誤差 (測定値):</strong> ${measurementError.toFixed(4)}</p>
          <p><strong>誤差 (フィルタ値):</strong> ${filterError.toFixed(4)}</p>
        `;
      }
    }
    
    // グラフを更新
    updateCharts();
  }
  
  // Chart.jsでグラフを初期化
  function initCharts() {
    if (!mainChartCanvas || !gainChartCanvas) return;
    
    // メインチャートの設定
    const mainCtx = mainChartCanvas.getContext('2d');
    mainChart = new Chart(mainCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: '真の値',
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            data: [],
            tension: 0.4
          },
          {
            label: '測定値（ノイズあり）',
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            data: [],
            tension: 0.1
          },
          {
            label: 'カルマンフィルタ推定値',
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.1)',
            borderWidth: 2,
            data: [],
            tension: 0.4
          }
        ]
      },
      options: {
        scales: {
          y: {
            min: -1.5,
            max: 1.5,
            title: {
              display: true,
              text: '値'
            }
          },
          x: {
            title: {
              display: true,
              text: '時間ステップ'
            }
          }
        },
        animation: false,
        responsive: true,
        maintainAspectRatio: false
      }
    });
    
    // ゲインチャートの設定
    const gainCtx = gainChartCanvas.getContext('2d');
    gainChart = new Chart(gainCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'カルマンゲイン (K)',
            borderColor: 'rgb(255, 159, 64)',
            backgroundColor: 'rgba(255, 159, 64, 0.1)',
            data: [],
            borderWidth: 2,
            tension: 0.4
          }
        ]
      },
      options: {
        scales: {
          y: {
            min: 0,
            max: 1,
            title: {
              display: true,
              text: 'ゲイン値'
            }
          },
          x: {
            title: {
              display: true,
              text: '時間ステップ'
            }
          }
        },
        animation: false,
        responsive: true,
        maintainAspectRatio: false
      }
    });
  }
  
  // グラフの更新
  function updateCharts() {
    if (!mainChart || !gainChart) {
      // グラフがまだ初期化されていない場合は初期化
      initCharts();
      if (!mainChart || !gainChart) return;  // 初期化に失敗した場合
    }
    
    // データセットの更新
    mainChart.data.labels = simulationState.data.labels;
    mainChart.data.datasets[0].data = simulationState.data.trueValues;
    mainChart.data.datasets[1].data = simulationState.data.measurements;
    mainChart.data.datasets[2].data = simulationState.data.filteredValues;
    
    gainChart.data.labels = simulationState.data.labels;
    gainChart.data.datasets[0].data = simulationState.data.kalmanGains;
    
    // チャートの更新
    mainChart.update();
    gainChart.update();
  }
  
  // 初期化
  try {
    initCharts();
  } catch (error) {
    console.error('Charts initialization error:', error);
  }
});
