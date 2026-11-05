"""Convert the explicitly licensed KOReader en-zh StarDict release to lookup data.
Input: downloaded en-zh.zip. No network and no execution of downloaded files.
The output remains CC BY-SA 4.0; retain dictionary attribution and licenses.
"""
import gzip, hashlib, html, json, re, struct, sys, zipfile
from pathlib import Path

word_re = re.compile(r"[a-z]+(?:[-'][a-z]+)*")
cjk_re = re.compile(r'[\u3400-\u9fff]')
def text(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', '', value))).strip()

def build(filename, output):
    with zipfile.ZipFile(filename) as archive:
        raw=archive.read('en-zh/en-zh.idx'); syn=archive.read('en-zh/en-zh.syn')
        body=gzip.decompress(archive.read('en-zh/en-zh.dict.dz'))
        attribution=archive.read('en-zh/ATTRIBUTION').decode('utf8')
        upstream_license=archive.read('en-zh/LICENSE').decode('utf8')
    dictionary={}; index=[]; position=0
    while position < len(raw):
        end=raw.index(0,position); word=raw[position:end].decode('utf8').lower(); start,size=struct.unpack('>II',raw[end+1:end+9]); position=end+9;index.append(word)
        if not word_re.fullmatch(word):continue
        record=body[start:start+size].decode('utf8')
        translations=[]
        for value in re.findall(r'<b>(.*?)</b>',record,re.S):
            meaning=text(value).replace('+','')
            if cjk_re.search(meaning) and not re.search(r'[A-Za-z]{4,}',meaning) and meaning not in translations:translations.append(meaning)
        if not translations:continue
        phonetic=re.search(r'<div[^>]*>/([^<]{1,120})/</div>',record)
        dictionary[word]=['；'.join(translations[:3]),text(phonetic.group(1)) if phonetic else '']
    forms={};position=0
    while position<len(syn):
        end=syn.index(0,position); variant=syn[position:end].decode('utf8').lower(); target=struct.unpack('>I',syn[end+1:end+5])[0];position=end+5
        if target<len(index) and word_re.fullmatch(variant) and variant not in dictionary and index[target] in dictionary:forms.setdefault(variant,index[target])
    sha=hashlib.sha256(Path(filename).read_bytes()).hexdigest()
    output=Path(output);chunks=output/'chunks';chunks.mkdir(parents=True,exist_ok=True)
    buckets={letter:{'dictionary':{},'forms':{}} for letter in 'abcdefghijklmnopqrstuvwxyz_'}
    shard=lambda word: word[0] if word and word[0] in 'abcdefghijklmnopqrstuvwxyz' else '_'
    for word,value in dictionary.items():buckets[shard(word)]['dictionary'][word]=value
    for word,value in forms.items():buckets[shard(word)]['forms'][word]=value
    total=0
    for letter,data in buckets.items():
        payload='/* English–Chinese data CC BY-SA 4.0; see ../LICENSE.txt. */\n'
        payload+='export const DICTIONARY='+json.dumps(data['dictionary'],ensure_ascii=False,separators=(',',':'))+';\n'
        payload+='export const WORD_FORMS='+json.dumps(data['forms'],ensure_ascii=False,separators=(',',':'))+';\n'
        (chunks/(letter+'.js')).write_text(payload,encoding='utf8');total+=len(payload.encode('utf8'))
    (output/'meta.js').write_text('export const DICTIONARY_META='+json.dumps({'entries':len(dictionary),'forms':len(forms),'sourceSha256':sha},separators=(',',':'))+';\n',encoding='utf8')
    print('entries',len(dictionary),'forms',len(forms),'bytes',total,'sha256',sha)
    return attribution,upstream_license
if __name__=='__main__':
    if len(sys.argv)!=3:raise SystemExit('Usage: python tools/convert-koreader.py en-zh.zip dictionary')
    build(sys.argv[1],sys.argv[2])
