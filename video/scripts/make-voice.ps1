# Generates one narration WAV per scene with the Windows built-in voice, and records each clip's length.
Add-Type -AssemblyName System.Speech
$root = Join-Path $PSScriptRoot '..'
$outDir = Join-Path $root 'public\voice'
New-Item -ItemType Directory -Force $outDir | Out-Null
$scenes = Get-Content (Join-Path $root 'narration.json') -Raw -Encoding UTF8 | ConvertFrom-Json

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice('Microsoft Zira Desktop')
$synth.Rate = 0
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo 44100, ([System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen), ([System.Speech.AudioFormat.AudioChannel]::Mono)

$durations = [ordered]@{}
foreach ($s in $scenes) {
  $file = Join-Path $outDir "$($s.id).wav"
  $synth.SetOutputToWaveFile($file, $format)
  $synth.Speak($s.text)
  $synth.SetOutputToNull()
  $bytes = (Get-Item $file).Length - 44
  $seconds = [math]::Round($bytes / (44100 * 2), 2)
  $durations[$s.id] = $seconds
  "{0,-14} {1,6}s" -f $s.id, $seconds
}
$durations | ConvertTo-Json | Out-File (Join-Path $root 'src\voice-durations.json') -Encoding utf8
"Total: {0}s" -f (($durations.Values | Measure-Object -Sum).Sum)
