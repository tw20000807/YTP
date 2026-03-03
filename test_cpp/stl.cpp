#include<iostream>
// #include<set>
#include <bits/stdc++.h>
using namespace std;
int glo = 10;
int main(){
    map<int,int> mp;
    set< int > s;
    multiset< int > ms;
    bitset<10> bs;
    for(int i = 0; i < 10; ++i) {
        s.insert(i + 1);
        ms.insert(i+1);ms.insert(i+1);
        mp[i] = i;
        bs.set(i);
    }
    
    cout << s.size() << " " << *s.begin() << "\n";

}