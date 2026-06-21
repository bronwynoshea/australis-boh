import re

with open('src/apps/delivery/forge/pages/ForgeManagementPage.tsx', 'r') as f:
    lines = f.readlines()

stack = []
issues = []

for i, line in enumerate(lines, 1):
    # Skip comments
    if line.strip().startswith('//'):
        continue
        
    # Find opening divs (not self-closing)
    opens = re.findall(r'<div\b[^/>]*?[^/]>', line)
    # Find closing divs
    closes = re.findall(r'</div>', line)
    
    for _ in opens:
        stack.append(('div', i))
    
    for _ in closes:
        if stack:
            stack.pop()
        else:
            issues.append(f'Line {i}: Unexpected </div>')

if stack:
    print('Unclosed divs:')
    for tag, line in reversed(stack):
        print(f'  Line {line}')
else:
    print('All divs properly closed')
    
if issues:
    print('\nExtra closing divs:')
    for issue in issues[:10]:
        print(issue)
